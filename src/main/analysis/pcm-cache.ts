import type { PcmAudio } from '@core/audio/types'
import { extractAnalysisPcm, extractPlaybackPcm } from '../ffmpeg/pcm'

type CacheEntry = {
  key: string
  pcm: PcmAudio
}

let analysisCache: CacheEntry | null = null
let playbackCache: CacheEntry | null = null

function cacheKey(filePath: string, audioStreamIndices: number[]): string {
  const tracks = [...audioStreamIndices].sort((a, b) => a - b).join(',')
  return `${filePath}|${tracks}`
}

export function clearPcmCache(): void {
  analysisCache = null
  playbackCache = null
}

export async function getAnalysisPcm(
  filePath: string,
  durationSeconds: number,
  audioStreamIndices: number[]
): Promise<PcmAudio> {
  const key = cacheKey(filePath, audioStreamIndices)

  if (analysisCache?.key === key) {
    return analysisCache.pcm
  }

  const pcm = await extractAnalysisPcm(filePath, durationSeconds, audioStreamIndices)
  analysisCache = { key, pcm }
  return pcm
}

/** Hi-fi preview mix — loaded lazily on first playback, separate from 16 kHz analysis cache. */
export async function getPlaybackPcm(
  filePath: string,
  durationSeconds: number,
  audioStreamIndices: number[]
): Promise<PcmAudio> {
  const key = cacheKey(filePath, audioStreamIndices)

  if (playbackCache?.key === key) {
    return playbackCache.pcm
  }

  const pcm = await extractPlaybackPcm(filePath, durationSeconds, audioStreamIndices)
  playbackCache = { key, pcm }
  return pcm
}
