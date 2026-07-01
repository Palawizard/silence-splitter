import { buildWaveformEnvelope } from '@core/audio/waveform-envelope'
import type { WaveformEnvelope } from '@core/models/waveform-envelope'
import { getAnalysisPcm } from './pcm-cache'

/** Hi-res peaks from cached analysis PCM — one bucket per requested pixel (capped). */
export async function buildWaveformDetail(
  filePath: string,
  durationSeconds: number,
  audioStreamIndices: number[],
  bucketCount: number
): Promise<WaveformEnvelope> {
  const pcm = await getAnalysisPcm(filePath, durationSeconds, audioStreamIndices)
  return buildWaveformEnvelope(pcm.samples, durationSeconds, bucketCount)
}
