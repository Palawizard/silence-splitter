/** Validate the gaming preset against the three local TimeBolt reference captures. */
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { analyzeRmsLevels } from '../src/core/audio'
import { defaultAnalysisTrackIndices } from '../src/core/media/default-analysis-tracks'
import { getPresetById } from '../src/core/presets'
import { buildKeepSegments } from '../src/core/segments'

const REFERENCES = [
  {
    name: 'Chameleon',
    path: 'F:\\Fast Documents\\Chameleon\\Chameleon 2026.06.30 - 21.19.51.04.mp4',
    targetKeptSeconds: 37 * 60 + 17,
    toleranceSeconds: 60,
    strict: false
  },
  {
    name: 'Funky',
    path: 'F:\\Fast Documents\\funky download\\[5-29-26] Funky_fps - ⚡retour du serveur RP !! ／ !help⚡.mp4',
    targetKeptSeconds: 96 * 60,
    toleranceSeconds: 60,
    strict: false
  },
  {
    name: 'Minecraft',
    path: 'F:\\Fast Documents\\video minecraft\\2026-05-20 00-33-28.mp4',
    targetKeptSeconds: 52 * 60 + 14,
    toleranceSeconds: 30,
    strict: false,
    forbiddenKeepWindow: { startSeconds: 81, endSeconds: 84.5 }
  },
  {
    name: 'Funky best of',
    path: 'F:\\Fast Documents\\funky best of.mp4',
    targetKeptSeconds: 77 * 60 + 35,
    toleranceSeconds: 1,
    strict: true,
    referenceJson: 'F:\\Fast Documents\\funky best of.mp4.json'
  }
]

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.round(seconds % 60)
  return `${minutes}m${remainder.toString().padStart(2, '0')}s`
}

async function main(): Promise<void> {
  const missing = REFERENCES.filter((reference) => !existsSync(reference.path))
  if (missing.length > 0) {
    throw new Error(`Missing reference media: ${missing.map((reference) => reference.name).join(', ')}`)
  }

  const probe = await import(pathToFileURL(resolve('src/main/ffmpeg/probe.ts')).href)
  const pcmModule = await import(pathToFileURL(resolve('src/main/ffmpeg/pcm.ts')).href)
  const params = getPresetById('gaming-energetic').params
  let failed = false

  for (const reference of REFERENCES) {
    const media = await probe.probeMedia(reference.path)
    const tracks = defaultAnalysisTrackIndices(media.audioStreams)
    const detection = await pcmModule.extractDetectionRmsWindows(reference.path, tracks)
    const analysis = analyzeRmsLevels(
      detection.rmsValues,
      detection.sampleRate,
      media.durationSeconds,
      params
    )
    const segments = buildKeepSegments(media.durationSeconds, analysis.silentRegions, params)
    const keptSeconds = segments.reduce(
      (sum, segment) => sum + segment.sourceEndSeconds - segment.sourceStartSeconds,
      0
    )
    const deltaSeconds = Math.abs(keptSeconds - reference.targetKeptSeconds)
    const durationPass = deltaSeconds <= reference.toleranceSeconds
    const windowPass = reference.forbiddenKeepWindow
      ? !segments.some(
          (segment) =>
            segment.sourceStartSeconds < reference.forbiddenKeepWindow!.endSeconds &&
            segment.sourceEndSeconds > reference.forbiddenKeepWindow!.startSeconds
        )
      : true
    let boundariesPass = true
    if (reference.referenceJson) {
      const timeline = JSON.parse(await readFile(reference.referenceJson, 'utf8')) as Array<{
        start: number
        duration: number
        operation: string
      }>
      const expected = timeline.filter((entry) => entry.operation === 'keep')
      boundariesPass =
        expected.length === segments.length &&
        expected.every(
          (entry, index) =>
            Math.abs(entry.start - segments[index].sourceStartSeconds) < 1e-6 &&
            Math.abs(
              entry.start + entry.duration - segments[index].sourceEndSeconds
            ) < 1e-6
        )
    }
    const pass = durationPass && windowPass && boundariesPass
    failed ||= reference.strict && !pass

    console.log(
      `${reference.strict ? (pass ? 'PASS' : 'FAIL') : 'INFO'} ${reference.name}: kept=${formatDuration(keptSeconds)}, ` +
        `target=${formatDuration(reference.targetKeptSeconds)}, delta=${deltaSeconds.toFixed(2)}s, ` +
        `segments=${segments.length}, threshold=${analysis.thresholdDb.toFixed(2)} dB, ` +
        `UI=${analysis.thresholdDisplayDb.toFixed(2)} dB`
    )
    if (!windowPass) {
      console.log('     unexpected kept activity in Minecraft 1:21–1:24.5 reference window')
    }
    if (!boundariesPass) {
      console.log('     TimeBolt boundary mismatch')
    }
  }

  if (failed) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
