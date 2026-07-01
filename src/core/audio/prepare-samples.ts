import { peakNormalize } from './normalize'

/** Shared normalization for detection and timeline waveform (same scale as threshold). */
export function prepareAnalysisSamples(
  samples: Float32Array,
  _sampleRate: number
): Float32Array {
  return peakNormalize(samples)
}
