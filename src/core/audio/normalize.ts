import { computePeakWindows } from './levels'

const DEFAULT_REFERENCE_PERCENTILE = 0.995

/** Scale samples so the loudest sample is 1.0 (Timebolt-style waveform normalization). */
export function peakNormalize(samples: Float32Array): Float32Array {
  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i])
    if (abs > peak) {
      peak = abs
    }
  }

  if (peak <= 0) {
    return samples
  }

  const normalized = new Float32Array(samples.length)
  const scale = 1 / peak
  for (let i = 0; i < samples.length; i++) {
    normalized[i] = samples[i] * scale
  }

  return normalized
}

/**
 * Scale by a high-percentile peak (not absolute max).
 * Avoids one loud spike squashing long streams — closer to Timebolt waveform scaling.
 */
export function referenceNormalize(
  samples: Float32Array,
  sampleRate: number = 16000,
  percentile: number = DEFAULT_REFERENCE_PERCENTILE
): Float32Array {
  if (samples.length === 0) {
    return samples
  }

  const windowPeaks = computePeakWindows(samples, sampleRate)
  if (windowPeaks.length === 0) {
    return samples
  }

  const sorted = [...windowPeaks].sort((a, b) => a - b)
  const refIndex = Math.min(sorted.length - 1, Math.floor(sorted.length * percentile))
  const ref = Math.max(sorted[refIndex], 1e-10)

  const normalized = new Float32Array(samples.length)
  const scale = 1 / ref
  for (let i = 0; i < samples.length; i++) {
    normalized[i] = samples[i] * scale
  }

  return normalized
}
