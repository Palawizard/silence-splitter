import { buildWaveformEnvelope } from '@core/audio/waveform-envelope'
import { WAVEFORM_MAX_BUCKETS, type WaveformEnvelope } from '@core/models/waveform-envelope'
import { ANALYSIS_SAMPLE_RATE, WAVEFORM_SAMPLE_RATE, buildAudioFilter } from './audio-filter'
import { runCommandBuffer } from './run'

export { ANALYSIS_SAMPLE_RATE, WAVEFORM_SAMPLE_RATE, buildAudioFilter }

function bufferToFloat32Samples(pcmBuffer: Buffer): Float32Array {
  return new Float32Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength / 4)
}

async function extractMonoPcmAtRate(
  filePath: string,
  audioStreamIndices: number[],
  sampleRate: number
): Promise<Float32Array> {
  const filter = buildAudioFilter(audioStreamIndices, sampleRate)
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
    String(sampleRate),
    'pipe:1'
  ])

  return bufferToFloat32Samples(pcmBuffer)
}

export async function extractAnalysisPcm(
  filePath: string,
  durationSeconds: number,
  audioStreamIndices: number[]
): Promise<{ samples: Float32Array; sampleRate: number; durationSeconds: number }> {
  const samples = await extractMonoPcmAtRate(filePath, audioStreamIndices, ANALYSIS_SAMPLE_RATE)
  return {
    samples,
    sampleRate: ANALYSIS_SAMPLE_RATE,
    durationSeconds
  }
}

export async function extractWaveformEnvelope(
  filePath: string,
  durationSeconds: number,
  audioStreamIndices: number[]
): Promise<WaveformEnvelope> {
  const samples = await extractMonoPcmAtRate(filePath, audioStreamIndices, WAVEFORM_SAMPLE_RATE)
  const bucketCount = Math.min(
    WAVEFORM_MAX_BUCKETS,
    Math.max(50, Math.round(durationSeconds * 4))
  )
  return buildWaveformEnvelope(samples, durationSeconds, bucketCount)
}
