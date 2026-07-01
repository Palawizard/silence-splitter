/**
 * Compare detection results across OBS track selections using activity-union mixing.
 * Run: npx tsx scripts/compare-tracks.ts <path>
 */
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { analyzeAudio } from '../src/core/audio'
import { defaultAnalysisTrackIndices } from '../src/core/media/default-analysis-tracks'
import { detectSilentRegionsFromRms, reclassifyShortActiveAsSilent } from '../src/core/audio/regions'
import { buildKeepSegments } from '../src/core/segments'
import { getPresetById } from '../src/core/presets'
import { buildAudioFilter } from '../src/main/ffmpeg/audio-filter'
import { runCommandBuffer } from '../src/main/ffmpeg/run'

const TARGET_KEPT = 52 * 60 + 14 // Minecraft Timebolt

function bufferToFloat32(pcmBuffer: Buffer): Float32Array {
  return new Float32Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength / 4)
}

async function extractWithFilter(filePath: string, filter: string): Promise<Float32Array> {
  const pcmBuffer = await runCommandBuffer('ffmpeg', [
    '-v', 'error', '-i', filePath,
    '-filter_complex', filter,
    '-map', '[a]', '-f', 'f32le', '-ac', '1', '-ar', '16000', 'pipe:1'
  ])
  return bufferToFloat32(pcmBuffer)
}

async function main(): Promise<void> {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Usage: npx tsx scripts/compare-tracks.ts <path>')
    process.exit(1)
  }

  const probe = await import(pathToFileURL(resolve('src/main/ffmpeg/probe.ts')).href)
  const media = await probe.probeMedia(filePath)
  const all = media.audioStreams.map((s) => s.index)

  const scenarios: { label: string; indices: number[] }[] = [
    { label: 'default (audible tracks)', indices: defaultAnalysisTrackIndices(media.audioStreams) },
    { label: 'all streams', indices: all },
    { label: 'tracks 1+2', indices: all.slice(0, 2) }
  ]

  console.log(`File: ${filePath}`)
  console.log(`Duration: ${(media.durationSeconds / 60).toFixed(1)} min, target kept: ${(TARGET_KEPT / 60).toFixed(1)} min`)
  console.log('')

  for (const scenario of scenarios) {
    const filter = buildAudioFilter(scenario.indices, 16000)
    const samples = await extractWithFilter(filePath, filter)
    let peak = 0
    for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]))

    const params = getPresetById('gaming-energetic').params
    const analysis = analyzeAudio({ samples, sampleRate: 16000, durationSeconds: media.durationSeconds }, params)
    let silent = detectSilentRegionsFromRms(analysis.rmsValues, 16000, analysis.threshold)
    silent = reclassifyShortActiveAsSilent(silent, media.durationSeconds, params.ignoreDetectionsShorterThanSeconds)
    const segments = buildKeepSegments(media.durationSeconds, silent, params)
    const kept = segments.reduce((s, x) => s + (x.sourceEndSeconds - x.sourceStartSeconds), 0)

    console.log(`--- ${scenario.label} ---`)
    console.log(`  filter: ${filter}`)
    console.log(`  raw peak: ${peak.toFixed(6)}, auto: ${analysis.thresholdDb.toFixed(1)} dB (UI ${analysis.thresholdDisplayDb.toFixed(0)})`)
    console.log(`  kept: ${(kept / 60).toFixed(1)} min (Δ ${((kept - TARGET_KEPT) / 60).toFixed(1)} min)`)
    console.log('')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
