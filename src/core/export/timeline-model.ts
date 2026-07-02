import { basename, parse } from 'node:path'
import type { KeepSegment } from '../models/keep-segment'
import type { MediaInfo } from '../models/media-info'
import type {
  TimelineExportModel,
  TimelineExportSegment,
  TimelineRate
} from './types'

const CANONICAL_RATES = [
  { fps: 24000 / 1001, timebase: 24, ntsc: true },
  { fps: 24, timebase: 24, ntsc: false },
  { fps: 25, timebase: 25, ntsc: false },
  { fps: 30000 / 1001, timebase: 30, ntsc: true },
  { fps: 30, timebase: 30, ntsc: false },
  { fps: 50, timebase: 50, ntsc: false },
  { fps: 60000 / 1001, timebase: 60, ntsc: true },
  { fps: 60, timebase: 60, ntsc: false }
]

function relativeDifference(left: number, right: number): number {
  return Math.abs(left - right) / Math.max(left, right)
}

export function createTimelineRate(framesPerSecond: number): TimelineRate {
  if (!Number.isFinite(framesPerSecond) || framesPerSecond <= 0) {
    throw new Error('A valid source frame rate is required for XML export')
  }

  const roundedTimebase = Math.round(framesPerSecond)
  const candidates = [
    ...CANONICAL_RATES,
    { fps: roundedTimebase, timebase: roundedTimebase, ntsc: false }
  ]
  const canonicalRate = candidates.reduce((closest, candidate) =>
    Math.abs(candidate.fps - framesPerSecond) < Math.abs(closest.fps - framesPerSecond)
      ? candidate
      : closest
  )
  if (relativeDifference(canonicalRate.fps, framesPerSecond) <= 0.001) {
    return {
      framesPerSecond: canonicalRate.fps,
      timebase: canonicalRate.timebase,
      ntsc: canonicalRate.ntsc
    }
  }
  throw new Error(`Unsupported source frame rate: ${framesPerSecond}`)
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

  const rate = createTimelineRate(media.video.nominalFrameRate ?? media.video.frameRate)
  const durationFrames = secondsToFrame(media.durationSeconds, rate.framesPerSecond)
  const segments = buildSegments(keepSegments, durationFrames, rate.framesPerSecond)
  const audioStreams = media.audioStreams.map((stream, index) => ({
    sourceStreamOrder: index + 1,
    sourceStreamIndex: stream.index,
    codec: stream.codec,
    channels: stream.channels,
    sampleRate: stream.sampleRate,
    language: stream.language,
    title: stream.title
  }))
  let sourceTrackIndex = 0
  const audioTracks = audioStreams.flatMap((stream) =>
    Array.from({ length: stream.channels }, (_unused, channelIndex) => {
      sourceTrackIndex += 1
      return {
        timelineTrackIndex: sourceTrackIndex,
        sourceTrackIndex,
        sourceStreamOrder: stream.sourceStreamOrder,
        sourceStreamIndex: stream.sourceStreamIndex,
        sourceChannelIndex: channelIndex + 1,
        groupIndex: stream.sourceStreamOrder,
        sampleRate: stream.sampleRate
      }
    })
  )

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
      audioStreams,
      audioTracks
    },
    segments,
    durationFrames: segments.at(-1)?.timelineOutFrame ?? 0
  }
}
