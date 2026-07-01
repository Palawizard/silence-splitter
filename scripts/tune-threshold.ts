/**
 * Grid-search auto threshold params against Timebolt reference videos.
 * Run: npx tsx scripts/tune-threshold.ts
 */
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { peakNormalize, computeRmsWindows, dbFsToRms } from '../src/core/audio'
import { detectSilentRegionsFromRms, reclassifyShortActiveAsSilent } from '../src/core/audio/regions'
import { buildKeepSegments } from '../src/core/segments'
import { getPresetById } from '../src/core/presets'
import type { ThresholdBias } from '../src/core/presets'
import { rmsToDbFs } from '../src/core/audio/db'

const REFERENCES = [
  {
    path: 'F:\\Fast Documents\\Chameleon\\Chameleon 2026.06.30 - 21.19.51.04.mp4',
    targetKeptSeconds: 37 * 60 + 17
  },
  {
    path: 'F:\\Fast Documents\\funky download\\[5-29-26] Funky_fps - ⚡retour du serveur RP !! ／ !help⚡.mp4',
    targetKeptSeconds: 96 * 60
  }
]

type Params = {
  speechMult: number
  speechBias: number
  fallbackMult: number
  fallbackBias: number
  fallbackAboveDb: number
}

function percentileDb(dbs: number[], p: number): number {
  return dbs[Math.floor(dbs.length * p)]
}

function autoDb(dbs: number[], bias: ThresholdBias, p: Params): number {
  const p5 = percentileDb(dbs, 0.05)
  const p10 = percentileDb(dbs, 0.1)
  const p15 = percentileDb(dbs, 0.15)
  const p25 = percentileDb(dbs, 0.25)
  const p75 = percentileDb(dbs, 0.75)
  const p85 = percentileDb(dbs, 0.85)

  const speechBand = Math.max(8, p75 - p25)
  const speech = p10 + speechBand * p.speechMult
  const fallback = p5 + Math.max(10, p85 - p15) * p.fallbackMult

  const speechWithBias = speech + p.speechBias
  const estimated =
    speechWithBias > p.fallbackAboveDb ? fallback + p.fallbackBias : speechWithBias

  return Math.min(-30, Math.max(-58, estimated))
}

function keptSeconds(
  durationSeconds: number,
  levels: number[],
  sampleRate: number,
  thresholdDb: number
): number {
  const params = getPresetById('gaming-energetic').params
  const threshold = dbFsToRms(thresholdDb)
  let silent = detectSilentRegionsFromRms(levels, sampleRate, threshold)
  silent = reclassifyShortActiveAsSilent(
    silent,
    durationSeconds,
    params.ignoreDetectionsShorterThanSeconds
  )
  const segments = buildKeepSegments(durationSeconds, silent, params)
  return segments.reduce((sum, seg) => sum + (seg.sourceEndSeconds - seg.sourceStartSeconds), 0)
}

async function main(): Promise<void> {
  const probe = await import(pathToFileURL(resolve('src/main/ffmpeg/probe.ts')).href)
  const pcmMod = await import(pathToFileURL(resolve('src/main/ffmpeg/pcm.ts')).href)

  const datasets = []
  for (const ref of REFERENCES) {
    const media = await probe.probeMedia(ref.path)
    const pcm = await pcmMod.extractAnalysisPcm(
      ref.path,
      media.durationSeconds,
      media.audioStreams.map((s) => s.index)
    )
    const levels = computeRmsWindows(peakNormalize(pcm.samples), pcm.sampleRate)
    const dbs = levels.map(rmsToDbFs).sort((a, b) => a - b)
    datasets.push({ ...ref, durationSeconds: media.durationSeconds, levels, dbs, sampleRate: pcm.sampleRate })
    const p = (q: number) => dbs[Math.floor(dbs.length * q)]
    const band = Math.max(8, p(0.75) - p(0.25))
    console.log(ref.path.split('\\').pop(), {
      p5: p(0.05).toFixed(1),
      p10: p(0.1).toFixed(1),
      p50: p(0.5).toFixed(1),
      speech: (p(0.1) + band * 0.35).toFixed(1),
      fallback: (p(0.05) + Math.max(10, p(0.85) - p(0.15)) * 0.22).toFixed(1)
    })
  }
  console.log('')

  let best: Params | null = null
  let bestScore = Infinity

  for (const speechMult of [0.3, 0.35]) {
    for (const speechBias of [8, 10]) {
      for (const fallbackMult of [0.2, 0.25, 0.3, 0.35, 0.4, 0.45]) {
        for (const fallbackBias of [0, 2, 4, 6]) {
          for (const fallbackAboveDb of [-50, -48, -46, -44, -42, -40, -38]) {
            const p: Params = { speechMult, speechBias, fallbackMult, fallbackBias, fallbackAboveDb }
            let score = 0
            for (const ds of datasets) {
              const db = autoDb(ds.dbs, 'aggressive', p)
              const kept = keptSeconds(ds.durationSeconds, ds.levels, ds.sampleRate, db)
              score += Math.abs(kept - ds.targetKeptSeconds)
            }
            if (score < bestScore) {
              bestScore = score
              best = p
            }
          }
        }
      }
    }
  }

  console.log('Best params:', best)
  console.log('Total delta seconds:', bestScore)
  for (const ds of datasets) {
    const db = autoDb(ds.dbs, 'aggressive', best!)
    const kept = keptSeconds(ds.durationSeconds, ds.levels, ds.sampleRate, db)
    console.log(
      `${ds.path.split('\\').pop()}: auto=${db.toFixed(1)} dB, kept=${(kept / 60).toFixed(1)} min, target=${(ds.targetKeptSeconds / 60).toFixed(1)} min`
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
