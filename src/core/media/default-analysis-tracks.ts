import type { AudioStreamInfo } from '@core/models/media-info'

/** OBS and similar recorders often include 2 kbps placeholder streams — skip for analysis. */
export const MIN_ANALYSIS_BITRATE = 32_000

/** Default analysis selection: audible tracks only. */
export function defaultAnalysisTrackIndices(streams: AudioStreamInfo[]): number[] {
  const audible = streams.filter((s) => (s.bitRate ?? 0) >= MIN_ANALYSIS_BITRATE)
  const selected = audible.length > 0 ? audible : streams
  return selected.map((s) => s.index)
}
