import type { ThresholdBias } from '@core/presets'
import { dbFsToRms, rmsToDbFs } from './db'

const BIAS_OFFSET_DB: Record<ThresholdBias, number> = {
  very_aggressive: 16,
  aggressive: 15,
  medium: 8,
  voice: 4
}

function percentileDb(dbs: number[], p: number): number {
  return dbs[Math.floor(dbs.length * p)]
}

/**
 * Timebolt-style auto "Filter below sound level".
 * Single speech-band formula; quiet-floor cap when p5 sits high (dense game bed).
 */
export function computeAutoThresholdDb(levelValues: number[], bias: ThresholdBias): number {
  if (levelValues.length === 0) {
    return -42
  }

  const dbs = levelValues.map(rmsToDbFs).sort((a, b) => a - b)
  const p5 = percentileDb(dbs, 0.05)
  const p10 = percentileDb(dbs, 0.1)
  const p25 = percentileDb(dbs, 0.25)
  const p75 = percentileDb(dbs, 0.75)

  const speechBand = Math.max(8, p75 - p25)
  let estimated = p10 + speechBand * 0.35 + BIAS_OFFSET_DB[bias]

  if (p5 > -70) {
    estimated = Math.min(estimated, p5 + 7.5)
  } else if (p5 < -80 && estimated < -55) {
    estimated = -55
  }

  return Math.min(-30, Math.max(-62, estimated))
}

export function computeAutoThreshold(levelValues: number[], bias: ThresholdBias): number {
  return dbFsToRms(computeAutoThresholdDb(levelValues, bias))
}
