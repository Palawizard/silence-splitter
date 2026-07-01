import type { ThresholdBias } from '@core/presets'
import { dbFsToRms, rmsToDbFs } from './db'

const BIAS_OFFSET_DB: Record<ThresholdBias, number> = {
  very_aggressive: 3,
  aggressive: 0,
  medium: -4,
  voice: -8
}

/**
 * TimeBolt automatic filter detection.
 *
 * It truncates each 40 ms RMS value to an integer dB, averages the distinct
 * values above -72.5 dB (with an initial divisor of one), then subtracts 2 dB.
 */
export function computeAutoThresholdDb(levelValues: number[], bias: ThresholdBias): number {
  if (levelValues.length === 0) {
    return -42 + BIAS_OFFSET_DB[bias]
  }

  const distinctDb = [...new Set(
    levelValues
      .map((value) => Math.trunc(rmsToDbFs(value)))
      .filter(Number.isFinite)
  )]

  let sum = 0
  let count = 1
  for (const db of distinctDb) {
    if (db > -72.5) {
      sum += db
      count++
    }
  }

  return Math.floor(sum / count) - 2 + BIAS_OFFSET_DB[bias]
}

export function computeAutoThreshold(levelValues: number[], bias: ThresholdBias): number {
  return dbFsToRms(computeAutoThresholdDb(levelValues, bias))
}
