import assert from 'node:assert/strict'
import { buildTimelineExportModel, createTimelineRate } from '../src/core/export'
import { filePathToUrl, generateResolveXml } from '../src/core/export/resolve'
import type { MediaInfo } from '../src/core/models/media-info'

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
      language: 'fra',
      title: 'Microphone'
    },
    {
      index: 5,
      codec: 'aac',
      channels: 1,
      sampleRate: 44100,
      title: 'Jeu'
    }
  ]
}

const model = buildTimelineExportModel(media, [
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
])

assert.deepEqual(createTimelineRate(30000 / 1001), {
  framesPerSecond: 30000 / 1001,
  timebase: 30,
  ntsc: true
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
assert.deepEqual(model.source.audioTracks, [
  {
    timelineTrackIndex: 1,
    sourceStreamIndex: 2,
    sourceTrackIndex: 1,
    codec: 'aac',
    channels: 2,
    sampleRate: 48000,
    language: 'fra',
    title: 'Microphone'
  },
  {
    timelineTrackIndex: 2,
    sourceStreamIndex: 5,
    sourceTrackIndex: 2,
    codec: 'aac',
    channels: 1,
    sampleRate: 44100,
    language: undefined,
    title: 'Jeu'
  }
])
assert.throws(() => createTimelineRate(27.5), /Unsupported source frame rate/)

const xml = generateResolveXml(model)
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
assert.equal(xml.match(/<file id="source-file-1"\/>/g)?.length, 5)
assert.equal(xml.match(/<clipitem id="audio-track-\d+-clip-\d+">/g)?.length, 4)
assert.equal(xml.match(/<mediatype>audio<\/mediatype>/g)?.length, 8)
assert.match(
  xml,
  /<clipitem id="audio-track-1-clip-1">[\s\S]*?<start>0<\/start>[\s\S]*?<end>38<\/end>[\s\S]*?<in>25<\/in>[\s\S]*?<out>63<\/out>[\s\S]*?<mediatype>audio<\/mediatype>[\s\S]*?<trackindex>1<\/trackindex>/
)
assert.match(
  xml,
  /<clipitem id="audio-track-2-clip-2">[\s\S]*?<start>38<\/start>[\s\S]*?<end>88<\/end>[\s\S]*?<in>125<\/in>[\s\S]*?<out>175<\/out>[\s\S]*?<mediatype>audio<\/mediatype>[\s\S]*?<trackindex>2<\/trackindex>/
)
assert.equal(xml.match(/<channelcount>2<\/channelcount>/g)?.length, 1)
assert.equal(xml.match(/<channelcount>1<\/channelcount>/g)?.length, 1)

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
  'Montage <test> & "validation"'
)
const specialPathXml = generateResolveXml(specialPathModel)
assert.match(
  specialPathXml,
  /<pathurl>file:\/\/\/C:\/Media%20%26%20Files\/caf%C3%A9%20%231%25\.mp4<\/pathurl>/
)
assert.match(specialPathXml, /<name>Montage &lt;test&gt; &amp; &quot;validation&quot;<\/name>/)

console.log('Epic 3 shared export model and Resolve XML: PASS')
