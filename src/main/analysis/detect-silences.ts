import { analyzeRmsLevels, prepareAnalysisSamples } from '@core/audio'
import {
  buildAnalysisWaveformEnvelope,
  defaultPreviewBucketCount
} from '@core/audio/waveform-envelope'
import type { KeepSegment } from '@core/models/keep-segment'
import type { TimelinePreviewData } from '@core/models/timeline-preview'
import type { DetectionParams } from '@core/presets'
import { buildTimelinePreviewData } from '@core/preview'
import { buildKeepSegments } from '@core/segments'
import { getAnalysisPcm } from './pcm-cache'
import { extractDetectionRmsWindows } from '../ffmpeg/pcm'

/**
 * Silence detection pipeline.
 * Audio track selection affects the analysis mix only — exports always reference
 * the original source file (Epic 3), never a derived analysis track.
 */
export type SilenceDetectionResult = {
  keepSegments: KeepSegment[]
  preview: TimelinePreviewData
  threshold: number
  thresholdDb: number
  thresholdDisplayDb: number
}

export async function runSilenceDetection(
  filePath: string,
  durationSeconds: number,
  audioStreamIndices: number[],
  params: DetectionParams
): Promise<SilenceDetectionResult> {
  const [pcm, detectionLevels] = await Promise.all([
    getAnalysisPcm(filePath, durationSeconds, audioStreamIndices),
    extractDetectionRmsWindows(filePath, durationSeconds, audioStreamIndices)
  ])
  const analysis = analyzeRmsLevels(
    detectionLevels.rmsValues,
    detectionLevels.sampleRate,
    durationSeconds,
    params
  )
  const keepSegments = buildKeepSegments(durationSeconds, analysis.silentRegions, params)
  const normalized = prepareAnalysisSamples(pcm.samples, pcm.sampleRate)
  const waveform = buildAnalysisWaveformEnvelope(
    normalized,
    durationSeconds,
    defaultPreviewBucketCount(durationSeconds)
  )
  const preview = buildTimelinePreviewData(keepSegments, durationSeconds, waveform)

  return {
    keepSegments,
    preview,
    threshold: analysis.threshold,
    thresholdDb: analysis.thresholdDb,
    thresholdDisplayDb: analysis.thresholdDisplayDb
  }
}
