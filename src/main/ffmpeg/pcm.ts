import { buildWaveformEnvelope } from '@core/audio/waveform-envelope'
import { WAVEFORM_MAX_BUCKETS, type WaveformEnvelope } from '@core/models/waveform-envelope'
import {
  ANALYSIS_SAMPLE_RATE,
  DETECTION_SAMPLE_RATE,
  WAVEFORM_SAMPLE_RATE,
  buildAudioFilter
} from './audio-filter'
import { runCommandBuffer, runCommandChunks } from './run'

export {
  ANALYSIS_SAMPLE_RATE,
  DETECTION_SAMPLE_RATE,
  WAVEFORM_SAMPLE_RATE,
  buildAudioFilter
}

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

/** Stream TimeBolt-compatible 40 ms RMS blocks without buffering full 48 kHz PCM. */
export async function extractDetectionRmsWindows(
  filePath: string,
  audioStreamIndices: number[]
): Promise<{ rmsValues: number[]; sampleRate: number }> {
  const filter = buildAudioFilter(audioStreamIndices, DETECTION_SAMPLE_RATE)
  const windowSamples = Math.round(DETECTION_SAMPLE_RATE * 0.04)
  const rmsValues: number[] = []
  let pendingByte: number | null = null
  let samplesInWindow = 0
  let sumSquares = 0

  function consumeSample(int16Sample: number): void {
    const sample = int16Sample / 32768
    sumSquares += sample * sample
    samplesInWindow++
    if (samplesInWindow === windowSamples) {
      rmsValues.push(Math.sqrt(sumSquares / windowSamples))
      samplesInWindow = 0
      sumSquares = 0
    }
  }

  await runCommandChunks(
    'ffmpeg',
    [
      '-v',
      'error',
      '-i',
      filePath,
      '-filter_complex',
      filter,
      '-map',
      '[a]',
      '-f',
      's16le',
      '-ac',
      '1',
      '-ar',
      String(DETECTION_SAMPLE_RATE),
      'pipe:1'
    ],
    (chunk) => {
      let offset = 0
      if (pendingByte !== null && chunk.length > 0) {
        const value = pendingByte | (chunk[0] << 8)
        consumeSample(value >= 0x8000 ? value - 0x10000 : value)
        pendingByte = null
        offset = 1
      }
      while (offset + 1 < chunk.length) {
        consumeSample(chunk.readInt16LE(offset))
        offset += 2
      }
      if (offset < chunk.length) {
        pendingByte = chunk[offset]
      }
    }
  )

  return { rmsValues, sampleRate: DETECTION_SAMPLE_RATE }
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
