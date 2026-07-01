import { buildAnalysisWaveformEnvelope } from '@core/audio/waveform-envelope'
import type { WaveformEnvelope } from '@core/models/waveform-envelope'
import { clamp } from '@core/time'
import { prepareAnalysisSamples } from '@core/audio/prepare-samples'
import { getAnalysisPcm } from './pcm-cache'

/** Hi-res peaks for a visible time window — same normalization as silence detection. */
export async function buildWaveformWindow(
  filePath: string,
  durationSeconds: number,
  audioStreamIndices: number[],
  startSeconds: number,
  endSeconds: number,
  bucketCount: number
): Promise<WaveformEnvelope> {
  const pcm = await getAnalysisPcm(filePath, durationSeconds, audioStreamIndices)

  const clampedStart = clamp(startSeconds, 0, durationSeconds)
  const clampedEnd = clamp(endSeconds, 0, durationSeconds)
  const windowStart = Math.min(clampedStart, clampedEnd)
  const windowEnd = Math.max(clampedStart, clampedEnd)
  const windowDuration = windowEnd - windowStart

  if (windowDuration <= 0 || pcm.samples.length === 0) {
    return { durationSeconds: windowDuration, bucketCount: 0, peaks: [] }
  }

  const normalized = prepareAnalysisSamples(pcm.samples, pcm.sampleRate)
  const startSample = Math.floor((windowStart / durationSeconds) * normalized.length)
  const endSample = Math.max(
    startSample + 1,
    Math.ceil((windowEnd / durationSeconds) * normalized.length)
  )
  const slice = normalized.subarray(startSample, endSample)

  return buildAnalysisWaveformEnvelope(slice, windowDuration, bucketCount)
}
