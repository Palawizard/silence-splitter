import assert from 'node:assert/strict'
import { buildTimelineExportModel, createTimelineRate } from '../src/core/export'
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

console.log('Epic 3 shared export model: PASS')
