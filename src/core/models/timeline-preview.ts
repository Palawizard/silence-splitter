import type { WaveformEnvelope } from './waveform-envelope'

export type TimeRegion = {
  startSeconds: number
  endSeconds: number
}

/** Read-only preview derived from the same KeepSegment[] used for XML export. */
export type TimelinePreviewData = {
  keepRegions: TimeRegion[]
  cutRegions: TimeRegion[]
  segmentCount: number
  keptDurationSeconds: number
  cutDurationSeconds: number
  waveform: WaveformEnvelope
}
