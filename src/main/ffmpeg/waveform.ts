import { WAVEFORM_MAX_BUCKETS, type WaveformEnvelope } from '@core/models/waveform-envelope'
import { runCommandBuffer } from './run'

const WAVEFORM_SAMPLE_RATE = 8000

function buildAudioFilter(audioStreamIndices: number[]): string {
  if (audioStreamIndices.length === 0) {
    throw new Error('Au moins une piste audio doit être sélectionnée.')
  }

  if (audioStreamIndices.length === 1) {
    const index = audioStreamIndices[0]
    return `[0:${index}]aformat=channel_layouts=mono,aresample=${WAVEFORM_SAMPLE_RATE}[a]`
  }

  const inputs = audioStreamIndices.map((index) => `[0:${index}]`).join('')
  return `${inputs}amix=inputs=${audioStreamIndices.length}:duration=longest:dropout_transition=0,aformat=channel_layouts=mono,aresample=${WAVEFORM_SAMPLE_RATE}[a]`
}

function computePeaks(samples: Float32Array, bucketCount: number): number[] {
  const peaks = new Array<number>(bucketCount).fill(0)
  const samplesPerBucket = Math.max(1, Math.floor(samples.length / bucketCount))

  for (let bucket = 0; bucket < bucketCount; bucket++) {
    const start = bucket * samplesPerBucket
    const end = bucket === bucketCount - 1 ? samples.length : start + samplesPerBucket
    let peak = 0

    for (let i = start; i < end; i++) {
      const abs = Math.abs(samples[i])
      if (abs > peak) {
        peak = abs
      }
    }

    peaks[bucket] = peak
  }

  const maxPeak = Math.max(...peaks, 1e-9)
  return peaks.map((value) => value / maxPeak)
}

export async function extractWaveformEnvelope(
  filePath: string,
  durationSeconds: number,
  audioStreamIndices: number[]
): Promise<WaveformEnvelope> {
  const filter = buildAudioFilter(audioStreamIndices)
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
  const peaks = computePeaks(samples, bucketCount)

  return {
    durationSeconds,
    bucketCount,
    peaks
  }
}
