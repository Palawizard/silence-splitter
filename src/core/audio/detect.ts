import type { DetectionParams } from '@core/presets'
import { dbFsToRms } from './db'
import { detectSilentRegionsFromRms } from './regions'
import { computeRmsWindows } from './rms'
import { computeAutoThresholdDb } from './threshold'
import type { PcmAudio, SilentRegion } from './types'

export type AudioAnalysisResult = {
  rmsValues: number[]
  threshold: number
  thresholdDb: number
  thresholdDisplayDb: number
  silentRegions: SilentRegion[]
}

export function analyzeRmsLevels(
  rmsValues: number[],
  sampleRate: number,
  durationSeconds: number,
  params: DetectionParams
): AudioAnalysisResult {
  const thresholdDb = computeAutoThresholdDb(rmsValues, params.thresholdBias)
  const threshold = dbFsToRms(thresholdDb)
  const silentRegions = detectSilentRegionsFromRms(rmsValues, sampleRate, threshold)

  return {
    rmsValues,
    threshold,
    thresholdDb,
    thresholdDisplayDb: thresholdDb,
    silentRegions
  }
}

/** Analyze in-memory PCM. Production detection streams the same 40 ms RMS levels. */
export function analyzeAudio(pcm: PcmAudio, params: DetectionParams): AudioAnalysisResult {
  const rmsValues = computeRmsWindows(pcm.samples, pcm.sampleRate)
  return analyzeRmsLevels(rmsValues, pcm.sampleRate, pcm.durationSeconds, params)
}
