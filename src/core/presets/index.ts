export type ThresholdBias =
  | 'very_aggressive'
  | 'aggressive'
  | 'medium'
  | 'voice'

export type DetectionParams = {
  removeSilencesLongerThanSeconds: number
  ignoreDetectionsShorterThanSeconds: number
  leftPaddingSeconds: number
  rightPaddingSeconds: number
  thresholdBias: ThresholdBias
}

export type Preset = {
  id: string
  label: string
  params: DetectionParams
}

/** Timebolt gaming setup (user reference values). */
export const PRESETS: Preset[] = [
  {
    id: 'gaming-energetic',
    label: 'Gaming énergique',
    params: {
      removeSilencesLongerThanSeconds: 0.5,
      ignoreDetectionsShorterThanSeconds: 0.35,
      leftPaddingSeconds: 0.03,
      rightPaddingSeconds: 0.03,
      thresholdBias: 'aggressive'
    }
  },
  {
    id: 'gaming-chill',
    label: "Gaming chill / let's play",
    params: {
      removeSilencesLongerThanSeconds: 0.5,
      ignoreDetectionsShorterThanSeconds: 0.75,
      leftPaddingSeconds: 0.06,
      rightPaddingSeconds: 0.14,
      thresholdBias: 'medium'
    }
  },
  {
    id: 'podcast-facecam',
    label: 'Podcast / facecam',
    params: {
      removeSilencesLongerThanSeconds: 0.5,
      ignoreDetectionsShorterThanSeconds: 0.75,
      leftPaddingSeconds: 0.08,
      rightPaddingSeconds: 0.15,
      thresholdBias: 'voice'
    }
  },
  {
    id: 'tiktok-ultra-cut',
    label: 'TikTok ultra cut',
    params: {
      removeSilencesLongerThanSeconds: 0.5,
      ignoreDetectionsShorterThanSeconds: 0.75,
      leftPaddingSeconds: 0.02,
      rightPaddingSeconds: 0.1,
      thresholdBias: 'very_aggressive'
    }
  }
]

export const DEFAULT_PRESET_ID = PRESETS[0].id

export function getPresetById(id: string): Preset {
  const preset = PRESETS.find((p) => p.id === id)
  if (!preset) {
    throw new Error(`Unknown preset: ${id}`)
  }
  return preset
}
