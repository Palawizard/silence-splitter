/** Resample peaks to one value per canvas column (max-pool). */
export function resamplePeaksToColumns(peaks: number[], columnCount: number): number[] {
  if (columnCount <= 0) {
    return []
  }

  if (peaks.length === 0) {
    return new Array<number>(columnCount).fill(0)
  }

  if (peaks.length === columnCount) {
    return peaks
  }

  const columns = new Array<number>(columnCount).fill(0)

  for (let col = 0; col < columnCount; col++) {
    const start = Math.floor((col / columnCount) * peaks.length)
    const end = Math.max(start + 1, Math.floor(((col + 1) / columnCount) * peaks.length))
    let max = 0

    for (let i = start; i < end; i++) {
      if (peaks[i] > max) {
        max = peaks[i]
      }
    }

    columns[col] = max
  }

  return columns
}

/** Peak envelope per bucket — equal time slices, linear amplitude. */
export function computePeaks(samples: Float32Array, bucketCount: number): number[] {
  if (bucketCount <= 0 || samples.length === 0) {
    return []
  }

  const peaks = new Array<number>(bucketCount).fill(0)

  for (let bucket = 0; bucket < bucketCount; bucket++) {
    const start = Math.floor((bucket / bucketCount) * samples.length)
    const end = Math.floor(((bucket + 1) / bucketCount) * samples.length)
    let peak = 0

    for (let i = start; i < end; i++) {
      const abs = Math.abs(samples[i])
      if (abs > peak) {
        peak = abs
      }
    }

    peaks[bucket] = peak
  }

  return peaks
}

/**
 * Display normalization — compresses dynamic range so silence stays visibly low
 * while speech stands out (avoids a solid full-height bar).
 */
export function normalizePeaksForDisplay(peaks: number[]): number[] {
  if (peaks.length === 0) {
    return peaks
  }

  const sorted = [...peaks].sort((a, b) => a - b)
  const refIndex = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.92))
  const ref = Math.max(sorted[refIndex], 1e-9)

  return peaks.map((value) => {
    const scaled = Math.min(1, value / ref)
    return Math.sqrt(scaled)
  })
}
