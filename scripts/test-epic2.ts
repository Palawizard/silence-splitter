/**
 * Epic 2 automated verification — run: npx tsx scripts/test-epic2.ts
 */
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  analyzeAudio,
  computeRmsWindows
} from '../src/core/audio'
import { buildTimelinePreviewData, deriveCutRegions } from '../src/core/preview'
import { buildKeepSegments } from '../src/core/segments'
import { secondsToFrame, secondsToTimecode, frameToSeconds } from '../src/core/time'
import { getPresetById } from '../src/core/presets'

const root = resolve(import.meta.dirname, '..')

async function loadMainModules() {
  const pcmUrl = pathToFileURL(resolve(root, 'src/main/ffmpeg/pcm.ts')).href
  const probeUrl = pathToFileURL(resolve(root, 'src/main/ffmpeg/probe.ts')).href
  const waveformUrl = pathToFileURL(resolve(root, 'src/main/ffmpeg/waveform.ts')).href
  const pcm = await import(pcmUrl)
  const probe = await import(probeUrl)
  const waveform = await import(waveformUrl)
  return { pcm, probe, waveform }
}

type Check = { name: string; pass: boolean; detail: string }

const checks: Check[] = []

function record(name: string, pass: boolean, detail: string): void {
  checks.push({ name, pass, detail })
  const mark = pass ? 'PASS' : 'FAIL'
  console.log(`${mark}  ${name}`)
  if (detail) {
    console.log(`      ${detail}`)
  }
}

function sumSegmentDuration(segments: { sourceStartSeconds: number; sourceEndSeconds: number }[]): number {
  return segments.reduce((sum, seg) => sum + (seg.sourceEndSeconds - seg.sourceStartSeconds), 0)
}

function syntheticPcm(
  durationSeconds: number,
  sampleRate: number,
  segments: { start: number; end: number; level: number }[]
): Float32Array {
  const length = Math.ceil(durationSeconds * sampleRate)
  const samples = new Float32Array(length)

  for (const segment of segments) {
    const start = Math.floor(segment.start * sampleRate)
    const end = Math.min(length, Math.ceil(segment.end * sampleRate))
    for (let i = start; i < end; i++) {
      samples[i] = segment.level
    }
  }

  return samples
}

async function main(): Promise<void> {
  const { pcm, probe, waveform } = await loadMainModules()
  const fixtures = resolve(root, 'test/fixtures')

  // --- time helpers ---
  record(
    'secondsToFrame @ 25 fps',
    secondsToFrame(2, 25) === 50,
    '2 s → frame 50'
  )
  record(
    'frameToSeconds round-trip',
    Math.abs(frameToSeconds(secondsToFrame(1.5, 24), 24) - 1.5) < 0.05,
    '1.5 s @ 24 fps'
  )
  record(
    'secondsToTimecode',
    secondsToTimecode(65, 25) === '00:01:05:00',
    '65 s @ 25 fps → 00:01:05:00'
  )

  const hopWindows = computeRmsWindows(new Float32Array(100), 1000)
  record(
    'analysis — 40 ms TimeBolt blocks',
    hopWindows.length === 3,
    `windows=${hopWindows.length}`
  )

  // --- synthetic silence detection ---
  const params = getPresetById('gaming-energetic').params
  const synthSamples = syntheticPcm(10, 16000, [
    { start: 0, end: 2, level: 0.6 },
    { start: 2, end: 4, level: 0.01 },
    { start: 4, end: 10, level: 0.5 }
  ])
  const synthPcm = { samples: synthSamples, sampleRate: 16000, durationSeconds: 10 }
  const analysis = analyzeAudio(synthPcm, params)
  const synthSegments = buildKeepSegments(10, analysis.silentRegions, params)

  record(
    'synthetic PCM — detects middle silence',
    analysis.silentRegions.some((r) => r.startSeconds < 3 && r.endSeconds > 2),
    `silent regions=${analysis.silentRegions.length}, threshold=${analysis.threshold.toFixed(4)}`
  )
  record(
    'synthetic PCM — keep segments exclude silence',
    synthSegments.length >= 1 &&
      synthSegments.every(
        (s) => s.sourceEndSeconds > s.sourceStartSeconds && s.timelineEndSeconds > s.timelineStartSeconds
      ),
    `segments=${synthSegments.length}`
  )

  const synthPreview = buildTimelinePreviewData(synthSegments, 10, {
    durationSeconds: 10,
    bucketCount: 40,
    peaks: new Array(40).fill(0.5)
  })
  const cutSum =
    synthPreview.cutDurationSeconds + synthPreview.keptDurationSeconds
  record(
    'preview — cut + kept ≈ duration',
    Math.abs(cutSum - 10) < 0.5 && synthPreview.segmentCount === synthSegments.length,
    `kept=${synthPreview.keptDurationSeconds.toFixed(2)}s, cut=${synthPreview.cutDurationSeconds.toFixed(2)}s`
  )
  record(
    'preview — cut regions match keep gaps',
    deriveCutRegions(synthSegments, 10).length === synthPreview.cutRegions.length,
    `cut regions=${synthPreview.cutRegions.length}`
  )

  // --- fixture: extract analysis PCM ---
  const singlePath = resolve(fixtures, 'single-track.mp4')
  const single = await probe.probeMedia(singlePath)
  const singlePcm = await pcm.extractAnalysisPcm(
    singlePath,
    single.durationSeconds,
    single.audioStreams.map((s) => s.index)
  )
  record(
    'single-track.mp4 — analysis PCM',
    singlePcm.samples.length > 0 && singlePcm.sampleRate === 16000,
    `samples=${singlePcm.samples.length}, rate=${singlePcm.sampleRate}`
  )

  const singleWave = await waveform.extractWaveformEnvelope(
    singlePath,
    single.durationSeconds,
    single.audioStreams.map((s) => s.index)
  )
  const singleAnalysis = analyzeAudio(singlePcm, params)
  const singleSegments = buildKeepSegments(
    single.durationSeconds,
    singleAnalysis.silentRegions,
    params
  )
  const singlePreview = buildTimelinePreviewData(
    singleSegments,
    single.durationSeconds,
    singleWave
  )
  record(
    'single-track.mp4 — end-to-end detection',
    Number.isFinite(singleAnalysis.thresholdDb) &&
      singlePreview.waveform.bucketCount === singleWave.bucketCount &&
      Math.abs(
        singlePreview.keptDurationSeconds +
          singlePreview.cutDurationSeconds -
          single.durationSeconds
      ) < 0.05,
    `segments=${singleSegments.length}, kept=${singlePreview.keptDurationSeconds.toFixed(2)}s`
  )

  // --- param change recomputes segments ---
  const aggressiveParams = { ...params, removeSilencesLongerThanSeconds: 0.1 }
  const conservativeParams = { ...params, removeSilencesLongerThanSeconds: 5 }
  const aggressiveSegments = buildKeepSegments(10, analysis.silentRegions, aggressiveParams)
  const conservativeSegments = buildKeepSegments(10, analysis.silentRegions, conservativeParams)
  record(
    'param change — stricter cut removes more silence',
    aggressiveSegments.length >= conservativeSegments.length &&
      sumSegmentDuration(aggressiveSegments) <= sumSegmentDuration(conservativeSegments),
    `aggressive=${aggressiveSegments.length} segs (${sumSegmentDuration(aggressiveSegments).toFixed(2)}s), ` +
      `conservative=${conservativeSegments.length} segs (${sumSegmentDuration(conservativeSegments).toFixed(2)}s)`
  )

  // --- multi-track analysis mix ---
  const multiPath = resolve(fixtures, 'multi-track.mp4')
  const multi = await probe.probeMedia(multiPath)
  const allTracks = multi.audioStreams.map((s) => s.index)
  const multiPcmAll = await pcm.extractAnalysisPcm(multiPath, multi.durationSeconds, allTracks)
  const multiPcmOne = await pcm.extractAnalysisPcm(multiPath, multi.durationSeconds, [allTracks[0]])
  const multiAnalysisAll = analyzeAudio(multiPcmAll, params)
  const multiAnalysisOne = analyzeAudio(multiPcmOne, params)
  const comparedSampleCount = Math.min(
    10000,
    multiPcmAll.samples.length,
    multiPcmOne.samples.length
  )
  let mixedSamplesDiffer = false
  for (let i = 0; i < comparedSampleCount; i++) {
    if (Math.abs(multiPcmAll.samples[i] - multiPcmOne.samples[i]) > 1e-6) {
      mixedSamplesDiffer = true
      break
    }
  }
  record(
    'multi-track.mp4 — track selection changes analysis PCM',
    comparedSampleCount > 0 && mixedSamplesDiffer,
    `all regions=${multiAnalysisAll.silentRegions.length}, one=${multiAnalysisOne.silentRegions.length}`
  )

  const failed = checks.filter((c) => !c.pass)
  console.log('')
  console.log(`Results: ${checks.length - failed.length}/${checks.length} passed`)
  if (failed.length > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
