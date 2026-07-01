import type { PcmAudio } from '@core/audio/types'
import { extractAnalysisPcm } from '../ffmpeg/pcm'

type CacheEntry = {
  key: string
  pcm: PcmAudio
}

let cache: CacheEntry | null = null

function cacheKey(filePath: string, audioStreamIndices: number[]): string {
  const tracks = [...audioStreamIndices].sort((a, b) => a - b).join(',')
  return `${filePath}|${tracks}`
}

export function clearPcmCache(): void {
  cache = null
}

export async function getAnalysisPcm(
  filePath: string,
  durationSeconds: number,
  audioStreamIndices: number[]
): Promise<PcmAudio> {
  const key = cacheKey(filePath, audioStreamIndices)

  if (cache?.key === key) {
    return cache.pcm
  }

  const pcm = await extractAnalysisPcm(filePath, durationSeconds, audioStreamIndices)
  cache = { key, pcm }
  return pcm
}
