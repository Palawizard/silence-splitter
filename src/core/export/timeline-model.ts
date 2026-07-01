import { basename, parse } from 'node:path'
import type { KeepSegment } from '../models/keep-segment'
import type { MediaInfo } from '../models/media-info'
import type {
  TimelineExportModel,
  TimelineExportSegment,
  TimelineRate
} from './types'

const NTSC_RATES = [
  { fps: 24000 / 1001, timebase: 24 },
  { fps: 30000 / 1001, timebase: 30 },
  { fps: 60000 / 1001, timebase: 60 }
]

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.01
}

export function createTimelineRate(framesPerSecond: number): TimelineRate {
  if (!Number.isFinite(framesPerSecond) || framesPerSecond <= 0) {
    throw new Error('A valid source frame rate is required for XML export')
  }

  const ntscRate = NTSC_RATES.find((candidate) => nearlyEqual(candidate.fps, framesPerSecond))
  if (ntscRate) {
    return {
      framesPerSecond: ntscRate.fps,
      timebase: ntscRate.timebase,
      ntsc: true
    }
  }

  const timebase = Math.round(framesPerSecond)
  if (!nearlyEqual(timebase, framesPerSecond)) {
    throw new Error(`Unsupported source frame rate: ${framesPerSecond}`)
  }

  return { framesPerSecond, timebase, ntsc: false }
}

function secondsToFrame(seconds: number, framesPerSecond: number): number {
  return Math.round(seconds * framesPerSecond)
}

function buildSegments(
  keepSegments: KeepSegment[],
  durationFrames: number,
  framesPerSecond: number
): TimelineExportSegment[] {
  let timelineCursor = 0

  return keepSegments.map((segment, index) => {
    const sourceInFrame = Math.max(
      0,
      Math.min(durationFrames, secondsToFrame(segment.sourceStartSeconds, framesPerSecond))
    )
    const sourceOutFrame = Math.max(
      sourceInFrame,
      Math.min(durationFrames, secondsToFrame(segment.sourceEndSeconds, framesPerSecond))
    )

    if (sourceOutFrame <= sourceInFrame) {
      throw new Error(`Export segment ${index + 1} has no frame duration`)
    }

    const segmentDuration = sourceOutFrame - sourceInFrame
    const timelineInFrame = timelineCursor
    const timelineOutFrame = timelineInFrame + segmentDuration
    timelineCursor = timelineOutFrame

    return {
      index: index + 1,
      sourceInFrame,
      sourceOutFrame,
      timelineInFrame,
      timelineOutFrame
    }
  })
}

export function buildTimelineExportModel(
  media: MediaInfo,
  keepSegments: KeepSegment[],
  timelineName = `${parse(media.filePath).name} - silences coupés`
): TimelineExportModel {
  if (!media.video) {
    throw new Error('A video stream is required for XML export')
  }
  if (keepSegments.length === 0) {
    throw new Error('At least one keep segment is required for XML export')
  }

  const rate = createTimelineRate(media.video.frameRate)
  const durationFrames = secondsToFrame(media.durationSeconds, rate.framesPerSecond)
  const segments = buildSegments(keepSegments, durationFrames, rate.framesPerSecond)

  return {
    name: timelineName,
    rate,
    source: {
      filePath: media.filePath,
      fileName: basename(media.filePath),
      durationFrames,
      videoStreamIndex: media.video.index,
      width: media.video.width,
      height: media.video.height,
      audioTracks: media.audioStreams.map((stream, index) => ({
        timelineTrackIndex: index + 1,
        sourceStreamIndex: stream.index,
        sourceTrackIndex: index + 1,
        codec: stream.codec,
        channels: stream.channels,
        sampleRate: stream.sampleRate,
        language: stream.language,
        title: stream.title
      }))
    },
    segments,
    durationFrames: segments.at(-1)?.timelineOutFrame ?? 0
  }
}
