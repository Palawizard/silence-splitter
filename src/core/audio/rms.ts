import { RMS_WINDOW_MS } from './types'

/** Compute RMS energy per fixed window (linear amplitude, 0–1 range for normalized PCM). */
export function computeRmsWindows(
  samples: Float32Array,
  sampleRate: number,
  windowMs: number = RMS_WINDOW_MS
): number[] {
  if (samples.length === 0 || sampleRate <= 0) {
    return []
  }

  const windowSamples = Math.max(1, Math.round((sampleRate * windowMs) / 1000))
  const windowCount = Math.ceil(samples.length / windowSamples)
  const rmsValues = new Array<number>(windowCount)

  for (let window = 0; window < windowCount; window++) {
    const start = window * windowSamples
    const end = Math.min(samples.length, start + windowSamples)
    let sumSquares = 0

    for (let i = start; i < end; i++) {
      const sample = samples[i]
      sumSquares += sample * sample
    }

    const count = end - start
    rmsValues[window] = count > 0 ? Math.sqrt(sumSquares / count) : 0
  }

  return rmsValues
}

/** Window center time in seconds for a given window index. */
export function windowCenterSeconds(
  windowIndex: number,
  sampleRate: number,
  windowMs: number = RMS_WINDOW_MS
): number {
  const windowSamples = Math.max(1, Math.round((sampleRate * windowMs) / 1000))
  const centerSample = windowIndex * windowSamples + windowSamples / 2
  return centerSample / sampleRate
}

/** Total analyzed duration covered by RMS windows. */
export function rmsWindowDurationSeconds(
  windowCount: number,
  sampleRate: number,
  windowMs: number = RMS_WINDOW_MS
): number {
  if (windowCount === 0) {
    return 0
  }
  const windowSamples = Math.max(1, Math.round((sampleRate * windowMs) / 1000))
  return (windowCount * windowSamples) / sampleRate
}
