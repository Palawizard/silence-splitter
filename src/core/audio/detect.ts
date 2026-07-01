import type { DetectionParams } from '@core/presets'
import { computePeakWindows } from './levels'
import { prepareAnalysisSamples } from './prepare-samples'
import { computeAutoThreshold, computeAutoThresholdDb } from './threshold'
import { detectSilentRegionsFromRms, reclassifyShortActiveAsSilent } from './regions'
import type { PcmAudio, SilentRegion } from './types'

export type AudioAnalysisResult = {
  rmsValues: number[]
  threshold: number
  thresholdDb: number
  silentRegions: SilentRegion[]
}

/** Raw silence detection from PCM — param filtering happens in segment builder. */
export function analyzeAudio(pcm: PcmAudio, params: DetectionParams): AudioAnalysisResult {
  const normalized = prepareAnalysisSamples(pcm.samples, pcm.sampleRate)
  const levelValues = computePeakWindows(normalized, pcm.sampleRate)
  const thresholdDb = computeAutoThresholdDb(levelValues, params.thresholdBias)
  const threshold = computeAutoThreshold(levelValues, params.thresholdBias)
  let silentRegions = detectSilentRegionsFromRms(levelValues, pcm.sampleRate, threshold)
  silentRegions = reclassifyShortActiveAsSilent(
    silentRegions,
    pcm.durationSeconds,
    params.ignoreDetectionsShorterThanSeconds
  )

  return { rmsValues: levelValues, threshold, thresholdDb, silentRegions }
}
