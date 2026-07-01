export type PcmAudio = {
  samples: Float32Array
  sampleRate: number
  durationSeconds: number
}

export type SilentRegion = {
  startSeconds: number
  endSeconds: number
}

/** Analysis window size and hop. A 10 ms hop gives TimeBolt-like boundary precision. */
export const DETECTION_WINDOW_MS = 20
export const DETECTION_HOP_MS = 10

/** Kept as a public alias for existing callers. */
export const RMS_WINDOW_MS = DETECTION_WINDOW_MS
