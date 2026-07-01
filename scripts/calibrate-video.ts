/** Compare the production detector with a TimeBolt output-duration reference. */
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { analyzeRmsLevels } from '../src/core/audio'
import { defaultAnalysisTrackIndices } from '../src/core/media/default-analysis-tracks'
import { getPresetById } from '../src/core/presets'
import { buildKeepSegments } from '../src/core/segments'

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = Math.round(seconds % 60)
  return hours > 0
    ? `${hours}h${minutes}m${remainder}s`
    : `${minutes}m${remainder}s`
}

async function main(): Promise<void> {
  const videoPath = process.argv[2]
  const targetKeptMinutes = Number(process.argv[3])
  if (!videoPath || !Number.isFinite(targetKeptMinutes)) {
    console.error('Usage: npx tsx scripts/calibrate-video.ts <path> <kept-minutes>')
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
  const segments = buildKeepSegments(media.durationSeconds, analysis.silentRegions, params)
  const keptSeconds = segments.reduce(
    (sum, segment) => sum + segment.sourceEndSeconds - segment.sourceStartSeconds,
    0
  )
  const targetSeconds = targetKeptMinutes * 60

  console.log(`File: ${videoPath}`)
  console.log(`Threshold: ${analysis.thresholdDb.toFixed(2)} dB`)
  console.log(`Segments: ${segments.length}`)
  console.log(`Kept: ${formatDuration(keptSeconds)}`)
  console.log(`Target: ${formatDuration(targetSeconds)}`)
  console.log(`Delta: ${Math.abs(keptSeconds - targetSeconds).toFixed(2)} s`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
