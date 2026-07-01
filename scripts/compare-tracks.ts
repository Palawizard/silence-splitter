/** Compare production detection across audio-track selections. */
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { analyzeRmsLevels } from '../src/core/audio'
import { defaultAnalysisTrackIndices } from '../src/core/media/default-analysis-tracks'
import { getPresetById } from '../src/core/presets'
import { buildKeepSegments } from '../src/core/segments'

async function main(): Promise<void> {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Usage: npx tsx scripts/compare-tracks.ts <path>')
    process.exit(1)
  }

  const probe = await import(pathToFileURL(resolve('src/main/ffmpeg/probe.ts')).href)
  const pcmModule = await import(pathToFileURL(resolve('src/main/ffmpeg/pcm.ts')).href)
  const media = await probe.probeMedia(filePath)
  const all = media.audioStreams.map((stream) => stream.index)
  const scenarios = [
    { label: 'default', tracks: defaultAnalysisTrackIndices(media.audioStreams) },
    { label: 'all', tracks: all },
    ...all.map((track) => ({ label: `track ${track}`, tracks: [track] }))
  ]
  const params = getPresetById('gaming-energetic').params

  for (const scenario of scenarios) {
    const detection = await pcmModule.extractDetectionRmsWindows(
      filePath,
      media.durationSeconds,
      scenario.tracks
    )
    const analysis = analyzeRmsLevels(
      detection.rmsValues,
      detection.sampleRate,
      media.durationSeconds,
      params
    )
    const segments = buildKeepSegments(media.durationSeconds, analysis.silentRegions, params)
    const kept = segments.reduce(
      (sum, segment) => sum + segment.sourceEndSeconds - segment.sourceStartSeconds,
      0
    )
    console.log(
      `${scenario.label}: tracks=[${scenario.tracks.join(',')}], ` +
      `threshold=${analysis.thresholdDb.toFixed(0)} dB, segments=${segments.length}, ` +
      `kept=${(kept / 60).toFixed(2)} min`
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
