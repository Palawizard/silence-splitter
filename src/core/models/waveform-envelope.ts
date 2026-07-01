/** Decimated peak envelope for timeline preview (UI-only, not used for export). */
export type WaveformEnvelope = {
  durationSeconds: number
  bucketCount: number
  peaks: number[]
}

/** Cap bucket count for long sources — keeps preview responsive. */
export const WAVEFORM_MAX_BUCKETS = 1500
