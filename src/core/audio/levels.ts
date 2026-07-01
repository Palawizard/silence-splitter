import { RMS_WINDOW_MS } from './types'

/** Peak absolute amplitude per fixed window (waveform-style, 0–1 after peak normalization). */
export function computePeakWindows(
  samples: Float32Array,
  sampleRate: number,
  windowMs: number = RMS_WINDOW_MS
): number[] {
  if (samples.length === 0 || sampleRate <= 0) {
    return []
  }

  const windowSamples = Math.max(1, Math.round((sampleRate * windowMs) / 1000))
  const windowCount = Math.ceil(samples.length / windowSamples)
  const peaks = new Array<number>(windowCount)

  for (let window = 0; window < windowCount; window++) {
    const start = window * windowSamples
    const end = Math.min(samples.length, start + windowSamples)
    let peak = 0

    for (let i = start; i < end; i++) {
      const abs = Math.abs(samples[i])
      if (abs > peak) {
        peak = abs
      }
    }

    peaks[window] = peak
  }

  return peaks
}
