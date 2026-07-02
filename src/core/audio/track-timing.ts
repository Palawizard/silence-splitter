export function audioTrackTimingOffsetSeconds(
  mediaDurationSeconds: number,
  audioDurationSeconds: number | undefined
): number {
  if (audioDurationSeconds === undefined || !Number.isFinite(audioDurationSeconds)) {
    return 0
  }

  // TimeBolt rounds this alignment value to milliseconds before shifting PCM timestamps.
  return Number((audioDurationSeconds - mediaDurationSeconds).toFixed(3))
}
