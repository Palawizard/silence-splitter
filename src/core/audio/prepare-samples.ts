import { referenceNormalize } from './normalize'

/** Shared normalization for detection and timeline waveform. */
export function prepareAnalysisSamples(
  samples: Float32Array,
  sampleRate: number
): Float32Array {
  return referenceNormalize(samples, sampleRate)
}
