export type PcmAudio = {
  samples: Float32Array
  sampleRate: number
  durationSeconds: number
}

export type SilentRegion = {
  startSeconds: number
  endSeconds: number
}

export const RMS_WINDOW_MS = 20
