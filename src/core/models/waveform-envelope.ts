/** Decimated peak envelope for timeline preview (UI-only, not used for export). */
export type WaveformEnvelope = {
  durationSeconds: number
  bucketCount: number
  peaks: number[]
}

/** Cap for quick overview waveform on media load. */
export const WAVEFORM_MAX_BUCKETS = 1500

/** Buckets per second for timeline preview waveform (16 kHz analysis PCM). */
export const WAVEFORM_BUCKETS_PER_SECOND = 200

/** Cap for zoomed timeline preview — ~1 peak per pixel of canvas. */
export const WAVEFORM_HIRES_MAX_BUCKETS = 65536
