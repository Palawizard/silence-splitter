import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { buildTimelineExportModel } from '../src/core/export'
import { generatePremiereOtio, generatePremiereXml } from '../src/core/export/premiere'
import { premiereFilePathToUrl } from '../src/core/export/resolve'
import type { MediaInfo } from '../src/core/models/media-info'
import { writePremiereOtio, writePremiereXml } from '../src/main/export/premiere-xml'
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

const premiereOtio = generatePremiereOtio(model)
const premiereOtioObject = JSON.parse(premiereOtio) as {
  tracks: { children: Array<{ kind: string; metadata?: { fcp_xml?: Record<string, string> } }> }
  metadata?: { fcp_xml?: { media?: { video?: { format?: unknown } } } }
}

assert.equal(premiereOtioObject.OTIO_SCHEMA, 'Timeline.1')
assert.equal(premiereOtioObject.tracks.children.length, 3)
assert.equal(
  premiereOtioObject.tracks.children.filter((track) => track.kind === 'Audio').length,
  2
)
assert.equal(
  premiereOtioObject.tracks.children[1].metadata?.fcp_xml?.['@premiereTrackType'],
  'Stereo'
)
assert.equal(
  premiereOtioObject.tracks.children[2].metadata?.fcp_xml?.['@premiereTrackType'],
  'Mono'
)
assert.match(premiereOtio, /"@premiereChannelType":"stereo"/)
assert.match(premiereOtio, /"@premiereChannelType":"mono"/)
assert.match(premiereOtio, /"channelcount":2/)
assert.match(premiereOtio, /"channelcount":1/)
assert.match(premiereOtio, /"parameterid":"level"/)
assert.ok(premiereOtioObject.metadata?.fcp_xml?.media?.video?.format)

const premiereXml = generatePremiereXml(model)

assert.match(premiereXml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/)
assert.match(premiereXml, /<xmeml version="4">/)
assert.equal(premiereXml.match(/<clipitem id="audio-track-\d+-clip-\d+">/g)?.length, 6)
assert.equal(premiereXml.match(/<clipitem id="audio-stream-\d+-clip-\d+">/g)?.length ?? 0, 0)
assert.match(
  premiereXml,
  /<clipitem id="audio-track-1-clip-1">[\s\S]*?<channelcount>2<\/channelcount>[\s\S]*?<parameterid>pan<\/parameterid>\s*<value>-1<\/value>/
)
assert.match(
  premiereXml,
  /<clipitem id="audio-track-2-clip-1">[\s\S]*?<parameterid>pan<\/parameterid>\s*<value>1<\/value>/
)
assert.deepEqual(
  [...premiereXml.matchAll(/<outputchannelindex>(\d)<\/outputchannelindex>/g)].map((match) => match[1]),
  ['1', '2']
)
assert.equal(premiereXml.match(/<parameterid>pan<\/parameterid>/g)?.length ?? 0, 4)
assert.match(premiereXml, /<effectcategory>audiopan<\/effectcategory>/)
assert.equal(premiereXml.match(/<linkclipref>video-clip-1<\/linkclipref>/g)?.length, 4)
assert.equal(
  premiereFilePathToUrl('F:\\Fast Documents\\Chameleon\\clip.mp4'),
  'file://localhost/F:/Fast%20Documents/Chameleon/clip.mp4'
)
assert.doesNotMatch(premiereXml, /<pathurl>file:\/\/\/[A-Za-z]:\//)

async function testFileWriting(): Promise<void> {
  const fixtureMedia = await probeMedia(resolve('test/fixtures/multi-track.mp4'))
  assert.equal(fixtureMedia.audioStreams.length, 2)

  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'silence-splitter-epic4-'))
  try {
    const xmlOutput = await writePremiereXml(join(temporaryDirectory, 'timeline'), fixtureMedia, [
      {
        sourceStartSeconds: 1,
        sourceEndSeconds: 2,
        timelineStartSeconds: 0,
        timelineEndSeconds: 1
      }
    ])
    const writtenXml = await readFile(xmlOutput.xmlPath, 'utf8')
    assert.match(writtenXml, /<clipitem id="audio-track-2-clip-1">/)
    assert.equal(writtenXml.match(/<parameterid>pan<\/parameterid>/g)?.length ?? 0, 0)

    const otioOutput = await writePremiereOtio(join(temporaryDirectory, 'timeline-otio'), fixtureMedia, [
      {
        sourceStartSeconds: 1,
        sourceEndSeconds: 2,
        timelineStartSeconds: 0,
        timelineEndSeconds: 1
      }
    ])
    const writtenOtio = JSON.parse(await readFile(otioOutput.otioPath, 'utf8')) as {
      tracks: { children: unknown[] }
    }
    assert.equal(writtenOtio.tracks.children.length, 3)
    assert.equal((await readdir(xmlOutput.audioDirectoryPath!)).length, fixtureMedia.audioStreams.length)
    assert.equal((await readdir(otioOutput.audioDirectoryPath!)).length, fixtureMedia.audioStreams.length)
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}

testFileWriting()
  .then(() => console.log('Epic 4 Premiere Pro export: PASS'))
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
