/**
 * Calibrate silence detection against Timebolt reference for any video.
 * Run: npx tsx scripts/calibrate-video.ts <path> <kept-minutes> [timebolt-db]
 */
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  computePeakWindows,
  computeAutoThresholdDb,
  dbFsToRms,
  peakNormalize,
  referenceNormalize,
  toTimeboltDisplayDb
} from '../src/core/audio'
import { detectSilentRegionsFromRms, reclassifyShortActiveAsSilent } from '../src/core/audio/regions'
import { buildKeepSegments } from '../src/core/segments'
import { getPresetById, type DetectionParams } from '../src/core/presets'
import { defaultAnalysisTrackIndices } from '../src/core/media/default-analysis-tracks'
import type { PcmAudio } from '../src/core/audio/types'

async function loadMainModules() {
  const probeUrl = pathToFileURL(resolve(import.meta.dirname, '..', 'src/main/ffmpeg/probe.ts')).href
  const pcmUrl = pathToFileURL(resolve(import.meta.dirname, '..', 'src/main/ffmpeg/pcm.ts')).href
  return { probe: await import(probeUrl), pcm: await import(pcmUrl) }
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  if (h > 0) {
    return `${h}h${m}m${s}s`
  }
  return `${m}m${s}s`
}

function keptSeconds(
  durationSeconds: number,
  levelValues: number[],
  sampleRate: number,
  params: DetectionParams,
  thresholdDb: number
): number {
  const threshold = dbFsToRms(thresholdDb)
  let silent = detectSilentRegionsFromRms(levelValues, sampleRate, threshold)
  silent = reclassifyShortActiveAsSilent(
    silent,
    durationSeconds,
    params.ignoreDetectionsShorterThanSeconds
  )
  const segments = buildKeepSegments(durationSeconds, silent, params)
  return segments.reduce((sum, seg) => sum + (seg.sourceEndSeconds - seg.sourceStartSeconds), 0)
}

type NormMode = 'peak' | 'reference'

function levelsForPcm(pcm: PcmAudio, mode: NormMode): number[] {
  const samples = mode === 'reference' ? referenceNormalize(pcm.samples) : peakNormalize(pcm.samples)
  return computePeakWindows(samples, pcm.sampleRate)
}

async function main(): Promise<void> {
  const videoPath = process.argv[2]
  const targetKeptMinutes = Number(process.argv[3])
  const timeboltDb = process.argv[4] ? Number(process.argv[4]) : undefined

  if (!videoPath || !Number.isFinite(targetKeptMinutes)) {
    console.error('Usage: npx tsx scripts/calibrate-video.ts <path> <kept-minutes> [timebolt-db]')
    process.exit(1)
  }

  const targetKeptSeconds = targetKeptMinutes * 60
  const { probe, pcm } = await loadMainModules()
  const params = getPresetById('gaming-energetic').params

  const media = await probe.probeMedia(videoPath)
  const trackIndices = defaultAnalysisTrackIndices(media.audioStreams)
  const pcmData = await pcm.extractAnalysisPcm(videoPath, media.durationSeconds, trackIndices)

  console.log(`File: ${videoPath}`)
  console.log(`Duration: ${formatDuration(media.durationSeconds)}`)
  console.log(`Audio streams: ${media.audioStreams.length}`)
  console.log(`Target kept: ${formatDuration(targetKeptSeconds)}`)
  if (timeboltDb !== undefined) {
    console.log(`Timebolt filter: ${timeboltDb} dB`)
  }
  console.log('')

  for (const mode of ['peak', 'reference'] as NormMode[]) {
    const levelValues = levelsForPcm(pcmData, mode)
    const thresholdDb = computeAutoThresholdDb(levelValues, params.thresholdBias)
    const autoKept = keptSeconds(media.durationSeconds, levelValues, pcmData.sampleRate, params, thresholdDb)

    console.log(`[${mode}] auto=${thresholdDb.toFixed(1)} dB (UI ${toTimeboltDisplayDb(thresholdDb).toFixed(0)}) → kept ${formatDuration(autoKept)}`)

    if (timeboltDb !== undefined) {
      const internalDb = timeboltDb - 8
      const fixedKept = keptSeconds(
        media.durationSeconds,
        levelValues,
        pcmData.sampleRate,
        params,
        internalDb
      )
      console.log(`[${mode}] fixed UI ${timeboltDb} dB → kept ${formatDuration(fixedKept)}`)
    }

    let bestDb = thresholdDb
    let bestDelta = Math.abs(autoKept - targetKeptSeconds)
    for (let db = -60; db <= -28; db += 0.5) {
      const kept = keptSeconds(media.durationSeconds, levelValues, pcmData.sampleRate, params, db)
      const delta = Math.abs(kept - targetKeptSeconds)
      if (delta < bestDelta) {
        bestDelta = delta
        bestDb = db
      }
    }
    const bestKept = keptSeconds(media.durationSeconds, levelValues, pcmData.sampleRate, params, bestDb)
    console.log(
      `[${mode}] best=${bestDb.toFixed(1)} dB (UI ${toTimeboltDisplayDb(bestDb).toFixed(0)}) → kept ${formatDuration(bestKept)} (Δ${formatDuration(bestDelta)})`
    )
    console.log('')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
