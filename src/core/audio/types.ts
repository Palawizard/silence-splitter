export type PcmAudio = {
  samples: Float32Array
  sampleRate: number
  durationSeconds: number
}

/** Preview playback sample rate — matches detection grid, higher than analysis waveform cache. */
export const PLAYBACK_SAMPLE_RATE = 48000

export type SilentRegion = {
  startSeconds: number
  endSeconds: number
}

/** TimeBolt analyzes non-overlapping 40 ms RMS blocks. */
export const DETECTION_WINDOW_MS = 40
export const DETECTION_HOP_MS = 40

/** Kept as a public alias for existing callers. */
export const RMS_WINDOW_MS = DETECTION_WINDOW_MS
