import type { AudioStreamInfo, MediaInfo, VideoStreamInfo } from '@core/models/media-info'
import { runCommand } from './run'

type FfprobeStream = {
  index: number
  codec_type?: string
  codec_name?: string
  width?: number
  height?: number
  r_frame_rate?: string
  avg_frame_rate?: string
  channels?: number
  sample_rate?: string
  bit_rate?: string
  duration?: string
  tags?: {
    language?: string
    title?: string
  }
}

type FfprobeResult = {
  format?: {
    duration?: string
  }
  streams?: FfprobeStream[]
}

export function parseFrameRate(rate: string | undefined): number {
  if (!rate || rate === '0/0' || rate === 'N/A') {
    return 0
  }

  const parts = rate.split('/')
  if (parts.length !== 2) {
    return 0
  }

  const numerator = Number(parts[0])
  const denominator = Number(parts[1])
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0
  }

  return numerator / denominator
}

export function isVariableFrameRate(rFrameRate: string | undefined, avgFrameRate: string | undefined): boolean {
  const r = parseFrameRate(rFrameRate)
  const avg = parseFrameRate(avgFrameRate)

  if (avg === 0 && r > 0) {
    return true
  }

  if (r === 0 || avg === 0) {
    return false
  }

  const delta = Math.abs(r - avg) / Math.max(r, avg)
  return delta > 0.01
}

function mapVideoStream(stream: FfprobeStream): VideoStreamInfo {
  const frameRate = parseFrameRate(stream.avg_frame_rate) || parseFrameRate(stream.r_frame_rate)
  const nominalFrameRate = parseFrameRate(stream.r_frame_rate) || frameRate

  return {
    index: stream.index,
    codec: stream.codec_name ?? 'unknown',
    width: stream.width ?? 0,
    height: stream.height ?? 0,
    frameRate,
    nominalFrameRate,
    isVariableFrameRate: isVariableFrameRate(stream.r_frame_rate, stream.avg_frame_rate)
  }
}

function mapAudioStream(stream: FfprobeStream): AudioStreamInfo {
  const bitRate = Number(stream.bit_rate)
  const durationSeconds = Number(stream.duration)
  return {
    index: stream.index,
    codec: stream.codec_name ?? 'unknown',
    channels: stream.channels ?? 0,
    sampleRate: Number(stream.sample_rate) || 0,
    durationSeconds: Number.isFinite(durationSeconds) && durationSeconds > 0
      ? durationSeconds
      : undefined,
    bitRate: Number.isFinite(bitRate) && bitRate > 0 ? bitRate : undefined,
    language: stream.tags?.language,
    title: stream.tags?.title
  }
}

const mediaInfoCache = new Map<string, Promise<MediaInfo>>()

export async function probeAudioTrackTimingOffsets(
  filePath: string,
  mediaDurationSeconds: number,
  audioStreamIndices: number[]
): Promise<Record<number, number>> {
  const media = await probeMedia(filePath)
  const selected = new Set(audioStreamIndices)
  return Object.fromEntries(
    media.audioStreams
      .filter((stream) => selected.has(stream.index) && stream.durationSeconds !== undefined)
      // TimeBolt rounds its per-track duration offset to milliseconds.
      .map((stream) => [
        stream.index,
        Number((stream.durationSeconds! - mediaDurationSeconds).toFixed(3))
      ])
  )
}

export async function probeMedia(filePath: string): Promise<MediaInfo> {
  const cached = mediaInfoCache.get(filePath)
  if (cached) {
    return cached
  }

  const pending = probeMediaUncached(filePath)
  mediaInfoCache.set(filePath, pending)
  pending.catch(() => mediaInfoCache.delete(filePath))
  return pending
}

async function probeMediaUncached(filePath: string): Promise<MediaInfo> {
  const { stdout } = await runCommand('ffprobe', [
    '-v',
    'quiet',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    filePath
  ])

  let parsed: FfprobeResult
  try {
    parsed = JSON.parse(stdout) as FfprobeResult
  } catch {
    throw new Error('Impossible de lire les métadonnées du fichier.')
  }

  const streams = parsed.streams ?? []
  const videoStream = streams.find((s) => s.codec_type === 'video')
  const audioStreams = streams.filter((s) => s.codec_type === 'audio').map(mapAudioStream)

  const durationSeconds = Number(parsed.format?.duration) || 0

  return {
    filePath,
    durationSeconds,
    video: videoStream ? mapVideoStream(videoStream) : undefined,
    audioStreams
  }
}
