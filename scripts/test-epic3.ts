import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { buildTimelineExportModel, createTimelineRate } from '../src/core/export'
import { filePathToUrl, generateResolveOtio, generateResolveXml } from '../src/core/export/resolve'
import type { MediaInfo } from '../src/core/models/media-info'
import {
  ensureOtioExtension,
  ensureXmlExtension,
  writeResolveOtio,
  writeResolveXml
} from '../src/main/export/resolve-xml'
import { probeMedia } from '../src/main/ffmpeg/probe'

const media: MediaInfo = {
  filePath: 'C:\\Media Files\\source.mp4',
  durationSeconds: 10,
  video: {
    index: 0,
    codec: 'h264',
    width: 1920,
    height: 1080,
    frameRate: 25,
    isVariableFrameRate: false
  },
  audioStreams: [
    {
      index: 2,
      codec: 'aac',
      channels: 2,
      sampleRate: 48000,
      durationSeconds: 9.84,
      language: 'fra',
      title: 'Microphone'
    },
    {
      index: 5,
      codec: 'aac',
      channels: 1,
      sampleRate: 44100,
      durationSeconds: 10.08,
      title: 'Jeu'
    }
  ]
}

const audioSidecars = [
  { sourceStreamIndex: 2, filePath: 'C:\\Exports\\source-track-01.m4a' },
  { sourceStreamIndex: 5, filePath: 'C:\\Exports\\source-track-02.m4a' }
]

const model = buildTimelineExportModel(
  media,
  [
    {
      sourceStartSeconds: 1,
      sourceEndSeconds: 2.52,
      timelineStartSeconds: 0,
      timelineEndSeconds: 1.52
    },
    {
      sourceStartSeconds: 5,
      sourceEndSeconds: 7,
      timelineStartSeconds: 1.52,
      timelineEndSeconds: 3.52
    }
  ],
  undefined,
  audioSidecars
)

assert.deepEqual(createTimelineRate(30000 / 1001), {
  framesPerSecond: 30000 / 1001,
  timebase: 30,
  ntsc: true
})
assert.deepEqual(createTimelineRate(59.98131975138647), {
  framesPerSecond: 60,
  timebase: 60,
  ntsc: false
})
assert.deepEqual(createTimelineRate(120), {
  framesPerSecond: 120,
  timebase: 120,
  ntsc: false
})
assert.deepEqual(model.segments, [
  {
    index: 1,
    sourceInFrame: 25,
    sourceOutFrame: 63,
    timelineInFrame: 0,
    timelineOutFrame: 38
  },
  {
    index: 2,
    sourceInFrame: 125,
    sourceOutFrame: 175,
    timelineInFrame: 38,
    timelineOutFrame: 88
  }
])
assert.equal(model.durationFrames, 88)
assert.equal(model.source.fileName, 'source.mp4')
assert.deepEqual(model.source.audioSources, [
  {
    sourceStreamOrder: 1,
    sourceStreamIndex: 2,
    filePath: 'C:\\Exports\\source-track-01.m4a',
    fileName: 'source-track-01.m4a',
    fileId: 'audio-file-1',
    channels: 2,
    sampleRate: 48000,
    sourceFrameOffset: 4
  },
  {
    sourceStreamOrder: 2,
    sourceStreamIndex: 5,
    filePath: 'C:\\Exports\\source-track-02.m4a',
    fileName: 'source-track-02.m4a',
    fileId: 'audio-file-2',
    channels: 1,
    sampleRate: 44100,
    sourceFrameOffset: -2
  }
])
assert.deepEqual(model.source.audioTracks, [
  {
    timelineTrackIndex: 1,
    sourceTrackIndex: 1,
    sourceStreamOrder: 1,
    sourceStreamIndex: 2,
    fileId: 'audio-file-1',
    sourceChannelIndex: 1,
    groupIndex: 1
  },
  {
    timelineTrackIndex: 2,
    sourceTrackIndex: 2,
    sourceStreamOrder: 1,
    sourceStreamIndex: 2,
    fileId: 'audio-file-1',
    sourceChannelIndex: 2,
    groupIndex: 1
  },
  {
    timelineTrackIndex: 3,
    sourceTrackIndex: 1,
    sourceStreamOrder: 2,
    sourceStreamIndex: 5,
    fileId: 'audio-file-2',
    sourceChannelIndex: 1,
    groupIndex: 2
  }
])
assert.throws(() => createTimelineRate(27.5), /Unsupported source frame rate/)
assert.throws(
  () =>
    buildTimelineExportModel(media, [
      {
        sourceStartSeconds: 0,
        sourceEndSeconds: 1,
        timelineStartSeconds: 0,
        timelineEndSeconds: 1
      }
    ]),
  /requires a remuxed sidecar/
)

const measuredRateModel = buildTimelineExportModel(
  {
    ...media,
    video: {
      ...media.video!,
      frameRate: 59.98131975138647,
      nominalFrameRate: 60
    }
  },
  [
    {
      sourceStartSeconds: 0,
      sourceEndSeconds: 1,
      timelineStartSeconds: 0,
      timelineEndSeconds: 1
    }
  ],
  undefined,
  audioSidecars
)
assert.deepEqual(measuredRateModel.rate, {
  framesPerSecond: 60,
  timebase: 60,
  ntsc: false
})

const xml = generateResolveXml(model)
const otio = JSON.parse(generateResolveOtio(model)) as {
  OTIO_SCHEMA: string
  tracks: {
    children: Array<{
      kind: string
      metadata: Record<string, unknown>
      children: Array<Record<string, unknown>>
    }>
  }
}
assert.equal(otio.OTIO_SCHEMA, 'Timeline.1')
assert.equal(otio.tracks.children.length, 3)
assert.equal(otio.tracks.children[0].children.length, model.segments.length)
assert.equal(otio.tracks.children[1].kind, 'Audio')
assert.deepEqual(otio.tracks.children[1].metadata, {
  Resolve_OTIO: { 'Audio Type': 'Stereo' }
})
assert.deepEqual(otio.tracks.children[2].metadata, {
  Resolve_OTIO: { 'Audio Type': 'Mono' }
})
assert.deepEqual(
  (otio.tracks.children[1].children[0].source_range as {
    start_time: { value: number }
  }).start_time.value,
  29
)
assert.equal(
  (
    otio.tracks.children[1].children[0].metadata as {
      Resolve_OTIO: { 'Link Group ID': number }
    }
  ).Resolve_OTIO['Link Group ID'],
  1
)
assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/)
assert.match(xml, /<xmeml version="5">/)
assert.match(xml, /<sequence id="sequence-1">/)
assert.match(xml, /<duration>88<\/duration>/)
assert.equal(xml.match(/<clipitem id="video-clip-\d+">/g)?.length, 2)
assert.match(
  xml,
  /<clipitem id="video-clip-1">[\s\S]*?<start>0<\/start>[\s\S]*?<end>38<\/end>[\s\S]*?<in>25<\/in>[\s\S]*?<out>63<\/out>/
)
assert.match(
  xml,
  /<clipitem id="video-clip-2">[\s\S]*?<start>38<\/start>[\s\S]*?<end>88<\/end>[\s\S]*?<in>125<\/in>[\s\S]*?<out>175<\/out>/
)
assert.equal(xml.match(/<file id="source-file-1">/g)?.length, 1)
assert.equal(xml.match(/<file id="source-file-1"\/>/g)?.length, 1)
assert.equal(xml.match(/<file id="audio-file-\d+">/g)?.length, 2)
assert.equal(xml.match(/<file id="audio-file-\d+"\/>/g)?.length, 4)
assert.equal(xml.match(/<clipitem id="audio-track-\d+-clip-\d+">/g)?.length, 6)
assert.match(
  xml,
  /<clipitem id="audio-track-1-clip-1">[\s\S]*?<start>0<\/start>[\s\S]*?<end>38<\/end>[\s\S]*?<in>29<\/in>[\s\S]*?<out>67<\/out>[\s\S]*?<mediatype>audio<\/mediatype>[\s\S]*?<trackindex>1<\/trackindex>/
)
assert.match(
  xml,
  /<clipitem id="audio-track-2-clip-2">[\s\S]*?<start>38<\/start>[\s\S]*?<end>88<\/end>[\s\S]*?<in>129<\/in>[\s\S]*?<out>179<\/out>[\s\S]*?<mediatype>audio<\/mediatype>[\s\S]*?<trackindex>2<\/trackindex>/
)
assert.match(
  xml,
  /<clipitem id="audio-track-3-clip-1">[\s\S]*?<start>0<\/start>[\s\S]*?<end>38<\/end>[\s\S]*?<in>23<\/in>[\s\S]*?<out>61<\/out>/
)
assert.equal(xml.match(/<channelcount>2<\/channelcount>/g)?.length, 1)
assert.equal(xml.match(/<channelcount>1<\/channelcount>/g)?.length, 1)
assert.equal(xml.match(/<linkclipref>video-clip-1<\/linkclipref>/g)?.length, 4)
assert.deepEqual(
  [...xml.matchAll(/<outputchannelindex>(\d)<\/outputchannelindex>/g)].map((match) => match[1]),
  ['1', '2']
)
assert.deepEqual(
  [...xml.matchAll(/<parameterid>pan<\/parameterid>\s*<value>(-?1)<\/value>/g)].map(
    (match) => match[1]
  ),
  ['-1', '-1', '1', '1']
)

assert.equal(
  filePathToUrl('C:\\Media & Files\\café #1%.mp4'),
  'file:///C:/Media%20%26%20Files/caf%C3%A9%20%231%25.mp4'
)
assert.equal(
  filePathToUrl('\\\\media-server\\rushes\\clip test.mp4'),
  'file://media-server/rushes/clip%20test.mp4'
)
assert.throws(() => filePathToUrl('relative/source.mp4'), /must be absolute/)

const specialPathModel = buildTimelineExportModel(
  {
    ...media,
    filePath: 'C:\\Media & Files\\café #1%.mp4'
  },
  [
    {
      sourceStartSeconds: 0,
      sourceEndSeconds: 1,
      timelineStartSeconds: 0,
      timelineEndSeconds: 1
    }
  ],
  'Montage <test> & "validation"',
  audioSidecars
)
const specialPathXml = generateResolveXml(specialPathModel)
assert.match(
  specialPathXml,
  /<pathurl>file:\/\/\/C:\/Media%20%26%20Files\/caf%C3%A9%20%231%25\.mp4<\/pathurl>/
)
assert.match(specialPathXml, /<name>Montage &lt;test&gt; &amp; &quot;validation&quot;<\/name>/)
assert.equal(ensureXmlExtension('C:\\Exports\\timeline'), 'C:\\Exports\\timeline.xml')
assert.equal(ensureXmlExtension('C:\\Exports\\timeline.XML'), 'C:\\Exports\\timeline.XML')
assert.equal(ensureOtioExtension('C:\\Exports\\timeline'), 'C:\\Exports\\timeline.otio')
assert.equal(ensureOtioExtension('C:\\Exports\\timeline.OTIO'), 'C:\\Exports\\timeline.OTIO')

async function testFileWriting(): Promise<void> {
  const fixtureMedia = await probeMedia(resolve('test/fixtures/multi-track.mp4'))
  assert.equal(fixtureMedia.audioStreams.length, 2)
  const fixtureModel = buildTimelineExportModel(
    fixtureMedia,
    [
      {
        sourceStartSeconds: 0,
        sourceEndSeconds: 1,
        timelineStartSeconds: 0,
        timelineEndSeconds: 1
      }
    ],
    undefined,
    fixtureMedia.audioStreams.map((stream, index) => ({
      sourceStreamIndex: stream.index,
      filePath: `C:\\Exports\\fixture-track-${index + 1}.m4a`
    }))
  )
  const fixtureXml = generateResolveXml(fixtureModel)
  assert.equal(fixtureXml.match(/<clipitem id="audio-track-\d+-clip-1">/g)?.length, 2)

  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'silence-splitter-epic3-'))
  try {
    const output = await writeResolveXml(join(temporaryDirectory, 'timeline'), fixtureMedia, [
      {
        sourceStartSeconds: 1,
        sourceEndSeconds: 2,
        timelineStartSeconds: 0,
        timelineEndSeconds: 1
      }
    ])
    assert.equal(output.xmlPath, join(temporaryDirectory, 'timeline.xml'))
    assert.equal(output.audioDirectoryPath, join(temporaryDirectory, 'timeline-audio'))
    const sidecarFiles = await readdir(output.audioDirectoryPath!)
    assert.equal(sidecarFiles.length, fixtureMedia.audioStreams.length)
    const writtenXml = await readFile(output.xmlPath, 'utf8')
    assert.match(writtenXml, /<sequence id="sequence-1">/)
    assert.match(writtenXml, /<clipitem id="audio-track-2-clip-1">/)

    const optimized = await writeResolveOtio(
      join(temporaryDirectory, 'optimized'),
      fixtureMedia,
      [
        {
          sourceStartSeconds: 1,
          sourceEndSeconds: 2,
          timelineStartSeconds: 0,
          timelineEndSeconds: 1
        }
      ]
    )
    assert.equal(optimized.otioPath, join(temporaryDirectory, 'optimized.otio'))
    const writtenOtio = JSON.parse(await readFile(optimized.otioPath!, 'utf8')) as {
      OTIO_SCHEMA: string
    }
    assert.equal(writtenOtio.OTIO_SCHEMA, 'Timeline.1')
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}

testFileWriting()
  .then(() => console.log('Epic 3 shared export model and Resolve timelines: PASS'))
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
