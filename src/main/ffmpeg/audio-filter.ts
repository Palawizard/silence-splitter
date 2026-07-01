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
  const maxExpression = audioStreamIndices
    .slice(1)
    .reduce(
      (expression, _, index) => `max(${expression},abs(val(${index + 1})))`,
      'abs(val(0))'
    )

  // Treat selected tracks as an activity union. Taking the strongest absolute
  // sample avoids phase cancellation and does not dilute one active track when
  // several silent OBS tracks are selected.
  return `${monoSteps};${mixInputs}amerge=inputs=${count}[merged];[merged]aeval='${maxExpression}':c=mono,aresample=${sampleRate}[a]`
}
