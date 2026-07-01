export const WAVEFORM_SAMPLE_RATE = 8000
export const ANALYSIS_SAMPLE_RATE = 16000
export const DETECTION_SAMPLE_RATE = 48000

function timingFilter(offsetSeconds: number): string {
  if (offsetSeconds < -0.000_001) {
    return `atrim=start=${(-offsetSeconds).toFixed(6)},asetpts=PTS-STARTPTS`
  }
  if (offsetSeconds > 0.000_001) {
    return `adelay=${(offsetSeconds * 1000).toFixed(3)}:all=1,asetpts=PTS-STARTPTS`
  }
  return 'asetpts=PTS-STARTPTS'
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

  return `${monoSteps};${mixInputs}amix=inputs=${count}:duration=longest:dropout_transition=0,aresample=${sampleRate}[a]`
}
