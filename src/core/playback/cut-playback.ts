import type { KeepSegment } from '../models/keep-segment'

export type CutPlaybackRange = {
  sourceStartSeconds: number
  sourceEndSeconds: number
  timelineStartSeconds: number
  timelineEndSeconds: number
}

export function cutTimelineDuration(segments: KeepSegment[]): number {
  return segments.reduce(
    (duration, segment) => Math.max(duration, segment.timelineEndSeconds),
    0
  )
}

export function timelineTimeToSourceTime(
  segments: KeepSegment[],
  timelineSeconds: number
): number {
  if (segments.length === 0) {
    return 0
  }

  const duration = cutTimelineDuration(segments)
  const clamped = Math.min(duration, Math.max(0, timelineSeconds))
  const segment =
    segments.find(
      (candidate) =>
        clamped >= candidate.timelineStartSeconds && clamped < candidate.timelineEndSeconds
    ) ?? segments[segments.length - 1]

  return Math.min(
    segment.sourceEndSeconds,
    segment.sourceStartSeconds + Math.max(0, clamped - segment.timelineStartSeconds)
  )
}

/** Map a source-time position to cut-timeline time for playback seek. */
export function sourceTimeToTimelineTime(
  segments: KeepSegment[],
  sourceSeconds: number
): number {
  if (segments.length === 0) {
    return 0
  }

  const clamped = Math.max(0, sourceSeconds)
  for (const segment of segments) {
    if (clamped >= segment.sourceStartSeconds && clamped < segment.sourceEndSeconds) {
      return segment.timelineStartSeconds + (clamped - segment.sourceStartSeconds)
    }
  }

  const nextKeep = segments.find((segment) => segment.sourceStartSeconds > clamped)
  if (nextKeep) {
    return nextKeep.timelineStartSeconds
  }

  return cutTimelineDuration(segments)
}

export function buildCutPlaybackRanges(
  segments: KeepSegment[],
  timelineStartSeconds: number,
  durationSeconds: number
): CutPlaybackRange[] {
  if (durationSeconds <= 0 || segments.length === 0) {
    return []
  }

  const timelineDuration = cutTimelineDuration(segments)
  const rangeStart = Math.min(timelineDuration, Math.max(0, timelineStartSeconds))
  const rangeEnd = Math.min(timelineDuration, rangeStart + durationSeconds)

  return segments.flatMap((segment) => {
    const timelineStart = Math.max(rangeStart, segment.timelineStartSeconds)
    const timelineEnd = Math.min(rangeEnd, segment.timelineEndSeconds)
    if (timelineEnd <= timelineStart) {
      return []
    }

    const sourceStart =
      segment.sourceStartSeconds + (timelineStart - segment.timelineStartSeconds)
    return [
      {
        sourceStartSeconds: sourceStart,
        sourceEndSeconds: sourceStart + (timelineEnd - timelineStart),
        timelineStartSeconds: timelineStart,
        timelineEndSeconds: timelineEnd
      }
    ]
  })
}
