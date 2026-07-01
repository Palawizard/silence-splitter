import type { DetectionParams } from '@core/presets'
import { computeRmsWindows } from './rms'
import { prepareAnalysisSamples } from './prepare-samples'
import { dbFsToRms, toTimeboltDisplayDb } from './db'
import { computeAutoThresholdDb } from './threshold'
import {
  detectSilentRegionsFromRms,
  reclassifyShortActiveAsSilent,
  suppressBriefMarginalActivity
} from './regions'
import type { PcmAudio, SilentRegion } from './types'

export type AudioAnalysisResult = {
  rmsValues: number[]
  threshold: number
  thresholdDb: number
  thresholdDisplayDb: number
  silentRegions: SilentRegion[]
}

function referenceDbToPeakDb(samples: Float32Array, referenceDb: number): number {
  let normalizedPeak = 0
  for (let i = 0; i < samples.length; i++) {
    normalizedPeak = Math.max(normalizedPeak, Math.abs(samples[i]))
  }
  if (normalizedPeak <= 0) {
    return referenceDb
  }
  return referenceDb - 20 * Math.log10(normalizedPeak)
}

/** Raw silence detection from PCM — param filtering happens in segment builder. */
export function analyzeAudio(pcm: PcmAudio, params: DetectionParams): AudioAnalysisResult {
  const normalized = prepareAnalysisSamples(pcm.samples, pcm.sampleRate)
  const rawLevelValues = computeRmsWindows(normalized, pcm.sampleRate)
  const thresholdDb = computeAutoThresholdDb(rawLevelValues, params.thresholdBias)
  const thresholdDisplayDb = toTimeboltDisplayDb(
    referenceDbToPeakDb(normalized, thresholdDb)
  )
  const threshold = dbFsToRms(thresholdDb)
  const levelValues = suppressBriefMarginalActivity(
    rawLevelValues,
    threshold,
    params.ignoreDetectionsShorterThanSeconds
  )
  let silentRegions = detectSilentRegionsFromRms(levelValues, pcm.sampleRate, threshold)
  silentRegions = reclassifyShortActiveAsSilent(
    silentRegions,
    pcm.durationSeconds,
    params.ignoreDetectionsShorterThanSeconds
  )

  return {
    rmsValues: levelValues,
    threshold,
    thresholdDb,
    thresholdDisplayDb,
    silentRegions
  }
}
