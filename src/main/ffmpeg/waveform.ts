import { buildWaveformEnvelope } from '@core/audio/waveform-envelope'
import { WAVEFORM_MAX_BUCKETS, type WaveformEnvelope } from '@core/models/waveform-envelope'
import { WAVEFORM_SAMPLE_RATE, buildAudioFilter } from './audio-filter'
import { runCommandBuffer } from './run'
import { probeAudioTrackTimingOffsets } from './probe'

export async function extractWaveformEnvelope(
  filePath: string,
  durationSeconds: number,
  audioStreamIndices: number[]
): Promise<WaveformEnvelope> {
  const timingOffsets = await probeAudioTrackTimingOffsets(
    filePath,
    durationSeconds,
    audioStreamIndices
  )
  const filter = buildAudioFilter(audioStreamIndices, WAVEFORM_SAMPLE_RATE, timingOffsets)
  const pcmBuffer = await runCommandBuffer('ffmpeg', [
    '-v',
    'error',
    '-i',
    filePath,
    '-filter_complex',
    filter,
    '-map',
    '[a]',
    '-f',
    'f32le',
    '-ac',
    '1',
    '-ar',
    String(WAVEFORM_SAMPLE_RATE),
    'pipe:1'
  ])

  const samples = new Float32Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength / 4)
  const bucketCount = Math.min(
    WAVEFORM_MAX_BUCKETS,
    Math.max(50, Math.round(durationSeconds * 4))
  )
  return buildWaveformEnvelope(samples, durationSeconds, bucketCount)
}
