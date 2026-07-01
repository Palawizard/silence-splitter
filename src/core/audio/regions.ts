import {
  DETECTION_HOP_MS,
  DETECTION_WINDOW_MS,
  type SilentRegion
} from './types'
import { dbFsToRms, rmsToDbFs } from './db'

function windowIsSilent(rms: number, threshold: number): boolean {
  return rms < threshold
}

export function windowIsSilentDb(rms: number, thresholdDb: number): boolean {
  return rmsToDbFs(rms) < thresholdDb
}

/** Group consecutive silent RMS blocks on the same source-time grid as TimeBolt. */
export function detectSilentRegionsFromRms(
  rmsValues: number[],
  _sampleRate: number,
  threshold: number,
  _windowMs: number = DETECTION_WINDOW_MS,
  hopMs: number = DETECTION_HOP_MS
): SilentRegion[] {
  if (rmsValues.length === 0) {
    return []
  }

  const regions: SilentRegion[] = []
  const hopSeconds = hopMs / 1000
  let regionStart: number | null = null

  for (let i = 0; i < rmsValues.length; i++) {
    const silent = windowIsSilent(rmsValues[i], threshold)
    const boundary = i * hopSeconds
    if (silent && regionStart === null) {
      regionStart = boundary
    } else if (!silent && regionStart !== null) {
      regions.push({ startSeconds: regionStart, endSeconds: boundary })
      regionStart = null
    }
  }

  if (regionStart !== null) {
    regions.push({
      startSeconds: regionStart,
      endSeconds: rmsValues.length * hopSeconds
    })
  }

  return regions
}

export function detectSilentRegionsFromRmsDb(
  rmsValues: number[],
  sampleRate: number,
  thresholdDb: number,
  windowMs: number = DETECTION_WINDOW_MS,
  hopMs: number = DETECTION_HOP_MS
): SilentRegion[] {
  return detectSilentRegionsFromRms(
    rmsValues,
    sampleRate,
    dbFsToRms(thresholdDb),
    windowMs,
    hopMs
  )
}

export function mergeAdjacentRegions(
  regions: SilentRegion[],
  gapToleranceSeconds: number
): SilentRegion[] {
  if (regions.length <= 1) {
    return regions
  }

  const sorted = [...regions].sort((a, b) => a.startSeconds - b.startSeconds)
  const merged: SilentRegion[] = [{ ...sorted[0] }]

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]
    const last = merged[merged.length - 1]
    if (current.startSeconds - last.endSeconds <= gapToleranceSeconds) {
      last.endSeconds = Math.max(last.endSeconds, current.endSeconds)
    } else {
      merged.push({ ...current })
    }
  }

  return merged
}
