import { buildCutPlaybackRanges, cutTimelineDuration } from '@core/playback'
import type { KeepSegment } from '@core/models/keep-segment'
import { getAnalysisPcm } from './pcm-cache'

export type PlaybackChunk = {
  samples: ArrayBuffer
  sampleRate: number
  timelineStartSeconds: number
  durationSeconds: number
  ended: boolean
}

export async function buildPlaybackChunk(
  filePath: string,
  mediaDurationSeconds: number,
  audioStreamIndices: number[],
  keepSegments: KeepSegment[],
  timelineStartSeconds: number,
  requestedDurationSeconds: number
): Promise<PlaybackChunk> {
  const pcm = await getAnalysisPcm(filePath, mediaDurationSeconds, audioStreamIndices)
  const ranges = buildCutPlaybackRanges(
    keepSegments,
    timelineStartSeconds,
    requestedDurationSeconds
  )
  const sampleCount = ranges.reduce(
    (count, range) =>
      count +
      Math.max(
        0,
        Math.round((range.sourceEndSeconds - range.sourceStartSeconds) * pcm.sampleRate)
      ),
    0
  )
  const samples = new Float32Array(sampleCount)
  let outputOffset = 0

  for (const range of ranges) {
    const sourceStart = Math.max(0, Math.round(range.sourceStartSeconds * pcm.sampleRate))
    const requestedSamples = Math.max(
      0,
      Math.round((range.sourceEndSeconds - range.sourceStartSeconds) * pcm.sampleRate)
    )
    const sourceEnd = Math.min(pcm.samples.length, sourceStart + requestedSamples)
    const sourceSamples = pcm.samples.subarray(sourceStart, sourceEnd)
    samples.set(sourceSamples, outputOffset)
    outputOffset += sourceSamples.length
  }

  const finalSamples = outputOffset === samples.length ? samples : samples.slice(0, outputOffset)
  const durationSeconds = finalSamples.length / pcm.sampleRate
  const timelineDuration = cutTimelineDuration(keepSegments)

  return {
    samples: finalSamples.buffer,
    sampleRate: pcm.sampleRate,
    timelineStartSeconds: Math.min(timelineDuration, Math.max(0, timelineStartSeconds)),
    durationSeconds,
    ended: timelineStartSeconds + durationSeconds >= timelineDuration - 1 / pcm.sampleRate
  }
}
