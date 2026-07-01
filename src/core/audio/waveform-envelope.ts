import type { WaveformEnvelope } from '@core/models/waveform-envelope'
import { WAVEFORM_HIRES_MAX_BUCKETS } from '@core/models/waveform-envelope'
import { computePeaks, normalizePeaksForDisplay } from './peaks'

export function buildWaveformEnvelope(
  samples: Float32Array,
  durationSeconds: number,
  bucketCount: number
): WaveformEnvelope {
  const capped = Math.min(
    WAVEFORM_HIRES_MAX_BUCKETS,
    Math.max(1, Math.round(bucketCount))
  )
  const rawPeaks = computePeaks(samples, capped)
  const peaks = normalizePeaksForDisplay(rawPeaks)

  return {
    durationSeconds,
    bucketCount: capped,
    peaks
  }
}

/** Linear peaks on already-normalized analysis PCM — matches silence threshold scale. */
export function buildAnalysisWaveformEnvelope(
  samples: Float32Array,
  durationSeconds: number,
  bucketCount: number
): WaveformEnvelope {
  const capped = Math.min(
    WAVEFORM_HIRES_MAX_BUCKETS,
    Math.max(1, Math.round(bucketCount))
  )
  const rawPeaks = computePeaks(samples, capped)
  const peaks = rawPeaks.map((value) => Math.min(1, value))

  return {
    durationSeconds,
    bucketCount: capped,
    peaks
  }
}

/** Default hi-res bucket count for timeline preview (~6–7 px per bucket at 15 s viewport). */
export function defaultPreviewBucketCount(durationSeconds: number): number {
  return Math.min(
    WAVEFORM_HIRES_MAX_BUCKETS,
    Math.max(500, Math.ceil(durationSeconds * 200))
  )
}
