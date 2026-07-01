/**
 * Compare Silence Splitter keep boundaries with an exported TimeBolt reference.
 * Run: npx tsx scripts/compare-timebolt-cuts.ts <video> <reference.json> [tolerance-ms]
 *
 * Supported JSON shapes:
 * - { keepSegments: [{ startSeconds, endSeconds }] }
 * - { keepSegments: [{ sourceStartSeconds, sourceEndSeconds }] }
 * - { segments: [...] }
 * - a top-level array using either field pair
 * - TimeBolt timeline entries: [{ start, duration, operation: "keep" | "remove" }]
 */
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { analyzeRmsLevels } from '../src/core/audio'
import { defaultAnalysisTrackIndices } from '../src/core/media/default-analysis-tracks'
import type { TimeRegion } from '../src/core/models/timeline-preview'
import { getPresetById } from '../src/core/presets'
import { buildKeepSegments } from '../src/core/segments'

type UnknownRecord = Record<string, unknown>

function readNumber(record: UnknownRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }
  return null
}

function parseRegions(value: unknown): TimeRegion[] {
  const root = value as UnknownRecord
  const entries = Array.isArray(value)
    ? value
    : Array.isArray(root?.keepSegments)
      ? root.keepSegments
      : Array.isArray(root?.segments)
        ? root.segments
        : null

  if (!entries) {
    throw new Error('Reference JSON must contain keepSegments or segments.')
  }

  return entries
    .filter((entry) => {
      if (!entry || typeof entry !== 'object') {
        return true
      }
      const operation = (entry as UnknownRecord).operation
      return operation === undefined || operation === 'keep'
    })
    .map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Invalid reference segment at index ${index}.`)
    }
    const record = entry as UnknownRecord
    const startSeconds = readNumber(record, ['sourceStartSeconds', 'startSeconds', 'start'])
    let endSeconds = readNumber(record, ['sourceEndSeconds', 'endSeconds', 'end'])
    const durationSeconds = readNumber(record, ['duration', 'durationSeconds'])
    if (endSeconds === null && startSeconds !== null && durationSeconds !== null) {
      endSeconds = startSeconds + durationSeconds
    }
    if (startSeconds === null || endSeconds === null || endSeconds <= startSeconds) {
      throw new Error(`Invalid reference boundaries at index ${index}.`)
    }
      return { startSeconds, endSeconds }
    })
}

function boundaries(regions: TimeRegion[]): number[] {
  return regions.flatMap((region) => [region.startSeconds, region.endSeconds])
}

function matchBoundaries(actual: number[], expected: number[], toleranceSeconds: number) {
  const available = new Set(actual.map((_, index) => index))
  const errors: number[] = []

  for (const target of expected) {
    let bestIndex = -1
    let bestError = Infinity
    for (const index of available) {
      const error = Math.abs(actual[index] - target)
      if (error < bestError) {
        bestError = error
        bestIndex = index
      }
    }
    if (bestIndex >= 0 && bestError <= toleranceSeconds) {
      available.delete(bestIndex)
      errors.push(bestError)
    }
  }

  const matched = errors.length
  return {
    matched,
    precision: actual.length === 0 ? 1 : matched / actual.length,
    recall: expected.length === 0 ? 1 : matched / expected.length,
    medianErrorSeconds: errors.length === 0
      ? null
      : [...errors].sort((a, b) => a - b)[Math.floor(errors.length / 2)],
    maxErrorSeconds: errors.length === 0 ? null : Math.max(...errors)
  }
}

function disagreementSeconds(actual: TimeRegion[], expected: TimeRegion[]): number {
  const points = [...new Set([...boundaries(actual), ...boundaries(expected)])].sort((a, b) => a - b)
  let disagreement = 0
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i]
    const end = points[i + 1]
    const middle = (start + end) / 2
    const actualKept = actual.some((region) => middle >= region.startSeconds && middle < region.endSeconds)
    const expectedKept = expected.some((region) => middle >= region.startSeconds && middle < region.endSeconds)
    if (actualKept !== expectedKept) {
      disagreement += end - start
    }
  }
  return disagreement
}

async function main(): Promise<void> {
  const videoPath = process.argv[2]
  const referencePath = process.argv[3]
  const toleranceMs = Number(process.argv[4] ?? 50)
  if (!videoPath || !referencePath || !Number.isFinite(toleranceMs) || toleranceMs < 0) {
    console.error('Usage: npx tsx scripts/compare-timebolt-cuts.ts <video> <reference.json> [tolerance-ms]')
    process.exit(1)
  }

  const probe = await import(pathToFileURL(resolve('src/main/ffmpeg/probe.ts')).href)
  const pcmModule = await import(pathToFileURL(resolve('src/main/ffmpeg/pcm.ts')).href)
  const media = await probe.probeMedia(videoPath)
  const tracks = defaultAnalysisTrackIndices(media.audioStreams)
  const detection = await pcmModule.extractDetectionRmsWindows(
    videoPath,
    media.durationSeconds,
    tracks
  )
  const params = getPresetById('gaming-energetic').params
  const analysis = analyzeRmsLevels(
    detection.rmsValues,
    detection.sampleRate,
    media.durationSeconds,
    params
  )
  const actual = buildKeepSegments(media.durationSeconds, analysis.silentRegions, params).map((segment) => ({
    startSeconds: segment.sourceStartSeconds,
    endSeconds: segment.sourceEndSeconds
  }))
  const expected = parseRegions(JSON.parse(await readFile(referencePath, 'utf8')))
  const result = matchBoundaries(boundaries(actual), boundaries(expected), toleranceMs / 1000)

  console.log(`Actual segments: ${actual.length}`)
  console.log(`TimeBolt segments: ${expected.length}`)
  console.log(`Boundary precision: ${(result.precision * 100).toFixed(2)}%`)
  console.log(`Boundary recall: ${(result.recall * 100).toFixed(2)}%`)
  console.log(`Median boundary error: ${result.medianErrorSeconds === null ? 'n/a' : `${(result.medianErrorSeconds * 1000).toFixed(1)} ms`}`)
  console.log(`Maximum matched error: ${result.maxErrorSeconds === null ? 'n/a' : `${(result.maxErrorSeconds * 1000).toFixed(1)} ms`}`)
  console.log(`Kept/cut disagreement: ${disagreementSeconds(actual, expected).toFixed(3)} s`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
