import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { buildTimelineExportModel } from '../src/core/export'
import { generatePremiereXml } from '../src/core/export/premiere'
import { generateResolveXml } from '../src/core/export/resolve'
import type { MediaInfo } from '../src/core/models/media-info'
import { writePremiereXml } from '../src/main/export/premiere-xml'
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

const premiereXml = generatePremiereXml(model)
const resolveXml = generateResolveXml(model)

assert.match(premiereXml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/)
assert.match(premiereXml, /<xmeml version="4">/)
assert.match(premiereXml, /<sequence id="sequence-1">/)
assert.match(premiereXml, /<duration>88<\/duration>/)
assert.equal(premiereXml.match(/<clipitem id="video-clip-\d+">/g)?.length, 2)
assert.match(
  premiereXml,
  /<clipitem id="video-clip-1">[\s\S]*?<start>0<\/start>[\s\S]*?<end>38<\/end>[\s\S]*?<in>25<\/in>[\s\S]*?<out>63<\/out>/
)
assert.equal(premiereXml.match(/<clipitem id="audio-track-\d+-clip-\d+">/g)?.length, 6)
assert.match(
  premiereXml,
  /<clipitem id="audio-track-1-clip-1">[\s\S]*?<start>0<\/start>[\s\S]*?<end>38<\/end>[\s\S]*?<in>29<\/in>[\s\S]*?<out>67<\/out>/
)
assert.deepEqual(
  [...premiereXml.matchAll(/<outputchannelindex>(\d)<\/outputchannelindex>/g)].map((match) => match[1]),
  ['1', '2']
)
assert.equal(premiereXml.match(/<parameterid>pan<\/parameterid>/g)?.length ?? 0, 0)
assert.equal(resolveXml.match(/<parameterid>pan<\/parameterid>/g)?.length ?? 0, 4)
assert.match(premiereXml, /<numOutputChannels>2<\/numOutputChannels>/)
assert.equal(premiereXml.match(/<linkclipref>video-clip-1<\/linkclipref>/g)?.length, 4)

async function testFileWriting(): Promise<void> {
  const fixtureMedia = await probeMedia(resolve('test/fixtures/multi-track.mp4'))
  assert.equal(fixtureMedia.audioStreams.length, 2)

  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'silence-splitter-epic4-'))
  try {
    const output = await writePremiereXml(join(temporaryDirectory, 'timeline'), fixtureMedia, [
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
    assert.match(writtenXml, /<xmeml version="4">/)
    assert.match(writtenXml, /<clipitem id="audio-track-2-clip-1">/)
    assert.equal(writtenXml.match(/<parameterid>pan<\/parameterid>/g)?.length ?? 0, 0)
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}

testFileWriting()
  .then(() => console.log('Epic 4 Premiere Pro XML export: PASS'))
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
