/**
 * Calibrate silence detection against Timebolt reference output.
 * Run: npx tsx scripts/calibrate-timebolt.ts [path-to-mp4]
 */
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  analyzeAudio,
  computeRmsWindows,
  dbFsToRms,
  peakNormalize
} from '../src/core/audio'
import { detectSilentRegionsFromRms, reclassifyShortActiveAsSilent } from '../src/core/audio/regions'
import { buildKeepSegments } from '../src/core/segments'
import { getPresetById, type DetectionParams } from '../src/core/presets'

const DEFAULT_VIDEO =
  'F:\\Fast Documents\\Chameleon\\Chameleon 2026.06.30 - 21.19.51.04.mp4'

/** Timebolt reference for Chameleon 2026.06.30 capture. */
const TARGET_KEPT_SECONDS = 37 * 60 + 17 // 37m17s
const TARGET_THRESHOLD_DB = -42

async function loadMainModules() {
  const probeUrl = pathToFileURL(resolve(import.meta.dirname, '..', 'src/main/ffmpeg/probe.ts')).href
  const pcmUrl = pathToFileURL(resolve(import.meta.dirname, '..', 'src/main/ffmpeg/pcm.ts')).href
  const probe = await import(probeUrl)
  const pcm = await import(pcmUrl)
  return { probe, pcm }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m${s}s`
}

function runPipeline(
  durationSeconds: number,
  levelValues: number[],
  sampleRate: number,
  params: DetectionParams,
  thresholdDb: number
) {
  const threshold = dbFsToRms(thresholdDb)
  let silent = detectSilentRegionsFromRms(levelValues, sampleRate, threshold)
  silent = reclassifyShortActiveAsSilent(
    silent,
    durationSeconds,
    params.ignoreDetectionsShorterThanSeconds
  )
  const segments = buildKeepSegments(durationSeconds, silent, params)
  const kept = segments.reduce(
    (sum, seg) => sum + (seg.sourceEndSeconds - seg.sourceStartSeconds),
    0
  )
  const cut = durationSeconds - kept
  return { kept, cut, segmentCount: segments.length, thresholdDb }
}

async function main(): Promise<void> {
  const videoPath = process.argv[2] ?? DEFAULT_VIDEO
  const { probe, pcm } = await loadMainModules()
  const params = getPresetById('gaming-energetic').params

  console.log(`File: ${videoPath}`)
  const media = await probe.probeMedia(videoPath)
  const trackIndices = media.audioStreams.map((s) => s.index)
  const pcmData = await pcm.extractAnalysisPcm(videoPath, media.durationSeconds, trackIndices)
  const normalized = peakNormalize(pcmData.samples)
  const levelValues = computeRmsWindows(normalized, pcmData.sampleRate)
  const analysis = analyzeAudio(pcmData, params)

  console.log(`Duration: ${formatDuration(media.durationSeconds)}`)
  console.log(`Target kept (Timebolt): ${formatDuration(TARGET_KEPT_SECONDS)}`)
  console.log(`Auto threshold: ${analysis.thresholdDb.toFixed(1)} dBFS`)
  console.log('')

  const autoSegments = buildKeepSegments(media.durationSeconds, analysis.silentRegions, params)
  const autoKept = autoSegments.reduce(
    (sum, seg) => sum + (seg.sourceEndSeconds - seg.sourceStartSeconds),
    0
  )
  console.log(
    `Auto (gaming-energetic): kept=${formatDuration(autoKept)} cut=${formatDuration(media.durationSeconds - autoKept)} segs=${autoSegments.length}`
  )

  const fixed = runPipeline(
    media.durationSeconds,
    levelValues,
    pcmData.sampleRate,
    params,
    TARGET_THRESHOLD_DB
  )
  console.log(
    `Fixed -42 dBFS: kept=${formatDuration(fixed.kept)} cut=${formatDuration(fixed.cut)} segs=${fixed.segmentCount}`
  )

  let bestDb = TARGET_THRESHOLD_DB
  let bestDelta = Math.abs(fixed.kept - TARGET_KEPT_SECONDS)

  for (let db = -55; db <= -30; db += 0.5) {
    const result = runPipeline(media.durationSeconds, levelValues, pcmData.sampleRate, params, db)
    const delta = Math.abs(result.kept - TARGET_KEPT_SECONDS)
    if (delta < bestDelta) {
      bestDelta = delta
      bestDb = db
    }
  }

  const best = runPipeline(
    media.durationSeconds,
    levelValues,
    pcmData.sampleRate,
    params,
    bestDb
  )
  console.log(
    `Best sweep: ${bestDb.toFixed(1)} dBFS → kept=${formatDuration(best.kept)} cut=${formatDuration(best.cut)} segs=${best.segmentCount} (Δ${formatDuration(bestDelta)})`
  )

  const tolerance = 120
  if (Math.abs(autoKept - TARGET_KEPT_SECONDS) > tolerance) {
    console.log('')
    console.log(`WARN: auto threshold off target by ${formatDuration(Math.abs(autoKept - TARGET_KEPT_SECONDS))}`)
    process.exit(1)
  }

  console.log('')
  console.log('PASS: within 2 min of Timebolt reference')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
