export const WAVEFORM_SAMPLE_RATE = 8000
export const ANALYSIS_SAMPLE_RATE = 16000

export function buildAudioFilter(
  audioStreamIndices: number[],
  sampleRate: number
): string {
  if (audioStreamIndices.length === 0) {
    throw new Error('Au moins une piste audio doit être sélectionnée.')
  }

  if (audioStreamIndices.length === 1) {
    const index = audioStreamIndices[0]
    return `[0:${index}]aformat=channel_layouts=mono,aresample=${sampleRate}[a]`
  }

  const monoSteps = audioStreamIndices
    .map((index, i) => `[0:${index}]aformat=channel_layouts=mono[s${i}]`)
    .join(';')
  const mixInputs = audioStreamIndices.map((_, i) => `[s${i}]`).join('')
  const count = audioStreamIndices.length

  // Mono each track first, then average mix (amix normalize on by default).
  return `${monoSteps};${mixInputs}amix=inputs=${count}:duration=longest:dropout_transition=0,aresample=${sampleRate}[a]`
}
