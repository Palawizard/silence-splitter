import { PLAYBACK_SAMPLE_RATE } from '@core/audio/types'

export const WAVEFORM_SAMPLE_RATE = 8000
export const ANALYSIS_SAMPLE_RATE = 16000
export const DETECTION_SAMPLE_RATE = 48000
export { PLAYBACK_SAMPLE_RATE }

function timingFilter(offsetSeconds: number): string {
  const shift = offsetSeconds < 0
    ? `PTS-${Math.abs(offsetSeconds).toFixed(3)}/TB`
    : `PTS+${offsetSeconds.toFixed(3)}/TB`
  return `asetpts=${shift},aresample=async=1:first_pts=0,aformat=sample_fmts=s16`
}

export function buildAudioFilter(
  audioStreamIndices: number[],
  sampleRate: number,
  timingOffsetsSeconds: Readonly<Record<number, number>> = {}
): string {
  if (audioStreamIndices.length === 0) {
    throw new Error('Au moins une piste audio doit être sélectionnée.')
  }

  if (audioStreamIndices.length === 1) {
    const index = audioStreamIndices[0]
    const timing = timingFilter(timingOffsetsSeconds[index] ?? 0)
    return `[0:${index}]aformat=channel_layouts=mono,volume=-3.0102999566dB,${timing},aresample=${sampleRate}[a]`
  }

  const monoSteps = audioStreamIndices
    .map(
      (index, i) => {
        const timing = timingFilter(timingOffsetsSeconds[index] ?? 0)
        return `[0:${index}]aformat=channel_layouts=mono,volume=-3.0102999566dB,${timing}[s${i}]`
      }
    )
    .join(';')
  const mixInputs = audioStreamIndices.map((_, i) => `[s${i}]`).join('')
  const count = audioStreamIndices.length

  return `${monoSteps};${mixInputs}amix=inputs=${count},aresample=${sampleRate}[a]`
}
