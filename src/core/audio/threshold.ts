import type { ThresholdBias } from '@core/presets'
import { dbFsToRms, rmsToDbFs } from './db'

const BIAS_OFFSET_DB: Record<ThresholdBias, number> = {
  very_aggressive: 16,
  aggressive: 13.5,
  medium: 8,
  voice: 4
}

const DENSE_BED_FLOOR_DB = -70
const DEEP_SILENCE_FLOOR_DB = -80
const DEEP_SILENCE_QUARTILE_DB = -58
const QUIET_SPREAD_MIN_OFFSET_DB = 5
const QUIET_SPREAD_MAX_OFFSET_DB = 10

function percentileDb(dbs: number[], p: number): number {
  return dbs[Math.floor(dbs.length * p)]
}

/**
 * Robust automatic sound threshold based on distribution percentiles.
 *
 * The three regimes cover recordings with a dense background bed, ordinary
 * speech/noise separation, and OBS captures containing long digital silence.
 * Percentiles are stable under short peaks and reference normalization makes
 * the result independent of the source's absolute gain.
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

  if (p5 > DENSE_BED_FLOOR_DB) {
    estimated = Math.min(estimated, p5 + 7.2)
  } else if (p5 < DEEP_SILENCE_FLOOR_DB && p25 < DEEP_SILENCE_QUARTILE_DB) {
    estimated = p25 + 0.3
  } else if (p5 < DEEP_SILENCE_FLOOR_DB) {
    // A long digital-silence tail can drag p10 down even when the useful audio
    // has an ordinary noise floor. Anchor to p25 and use the quiet-band spread
    // so intros containing only faint music do not determine the whole file.
    const quietSpread = p25 - p10
    const quietOffset = Math.min(
      QUIET_SPREAD_MAX_OFFSET_DB,
      Math.max(QUIET_SPREAD_MIN_OFFSET_DB, quietSpread * 0.224 + 1.5)
    )
    estimated = p25 + quietOffset
  }

  return Math.min(-30, Math.max(-70, estimated))
}

export function computeAutoThreshold(levelValues: number[], bias: ThresholdBias): number {
  return dbFsToRms(computeAutoThresholdDb(levelValues, bias))
}
