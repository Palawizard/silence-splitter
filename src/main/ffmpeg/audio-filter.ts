export const WAVEFORM_SAMPLE_RATE = 8000
export const ANALYSIS_SAMPLE_RATE = 16000
export const DETECTION_SAMPLE_RATE = 48000
export const TIMEBOLT_DECODER_TRIM_SECONDS = 0.017

export function buildAudioFilter(
  audioStreamIndices: number[],
  sampleRate: number
): string {
  if (audioStreamIndices.length === 0) {
    throw new Error('Au moins une piste audio doit être sélectionnée.')
  }

  if (audioStreamIndices.length === 1) {
    const index = audioStreamIndices[0]
    return `[0:${index}]aformat=channel_layouts=mono,volume=-3.0102999566dB,atrim=start=${TIMEBOLT_DECODER_TRIM_SECONDS},asetpts=PTS-STARTPTS,aresample=${sampleRate}[a]`
  }

  const monoSteps = audioStreamIndices
    .map(
      (index, i) =>
        `[0:${index}]aformat=channel_layouts=mono,volume=-3.0102999566dB[s${i}]`
    )
    .join(';')
  const mixInputs = audioStreamIndices.map((_, i) => `[s${i}]`).join('')
  const count = audioStreamIndices.length

  return `${monoSteps};${mixInputs}amix=inputs=${count}:duration=longest:dropout_transition=0,atrim=start=${TIMEBOLT_DECODER_TRIM_SECONDS},asetpts=PTS-STARTPTS,aresample=${sampleRate}[a]`
}
