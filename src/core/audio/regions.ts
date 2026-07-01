import { RMS_WINDOW_MS, type SilentRegion } from './types'
import { rmsWindowDurationSeconds, windowCenterSeconds } from './rms'
import { dbFsToRms, rmsToDbFs } from './db'

function windowIsSilent(rms: number, threshold: number): boolean {
  return rms < threshold
}

export function windowIsSilentDb(rms: number, thresholdDb: number): boolean {
  return rmsToDbFs(rms) < thresholdDb
}

/** Group consecutive silent RMS windows into contiguous regions in source time. */
export function detectSilentRegionsFromRms(
  rmsValues: number[],
  sampleRate: number,
  threshold: number,
  windowMs: number = RMS_WINDOW_MS
): SilentRegion[] {
  if (rmsValues.length === 0) {
    return []
  }

  const windowSeconds = windowMs / 1000
  const regions: SilentRegion[] = []
  let regionStart: number | null = null

  for (let i = 0; i < rmsValues.length; i++) {
    const silent = windowIsSilent(rmsValues[i], threshold)
    const windowStart = windowCenterSeconds(i, sampleRate, windowMs) - windowSeconds / 2

    if (silent && regionStart === null) {
      regionStart = Math.max(0, windowStart)
    } else if (!silent && regionStart !== null) {
      const windowEnd = windowCenterSeconds(i, sampleRate, windowMs) - windowSeconds / 2
      regions.push({ startSeconds: regionStart, endSeconds: windowEnd })
      regionStart = null
    }
  }

  if (regionStart !== null) {
    const analyzedEnd = rmsWindowDurationSeconds(rmsValues.length, sampleRate, windowMs)
    regions.push({ startSeconds: regionStart, endSeconds: analyzedEnd })
  }

  return mergeAdjacentRegions(regions, 0.001)
}

export function detectSilentRegionsFromRmsDb(
  rmsValues: number[],
  sampleRate: number,
  thresholdDb: number,
  windowMs: number = RMS_WINDOW_MS
): SilentRegion[] {
  return detectSilentRegionsFromRms(
    rmsValues,
    sampleRate,
    dbFsToRms(thresholdDb),
    windowMs
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

function invertRegions(
  cutRegions: SilentRegion[],
  durationSeconds: number
): SilentRegion[] {
  if (durationSeconds <= 0) {
    return []
  }

  const sorted = [...cutRegions].sort((a, b) => a.startSeconds - b.startSeconds)
  const active: SilentRegion[] = []
  let cursor = 0

  for (const cut of sorted) {
    if (cut.startSeconds > cursor) {
      active.push({ startSeconds: cursor, endSeconds: cut.startSeconds })
    }
    cursor = Math.max(cursor, cut.endSeconds)
  }

  if (cursor < durationSeconds) {
    active.push({ startSeconds: cursor, endSeconds: durationSeconds })
  }

  return active
}

/**
 * Timebolt: active bursts shorter than ignoreDetectionsShorterThan are reclassified as silence.
 */
export function reclassifyShortActiveAsSilent(
  silentRegions: SilentRegion[],
  durationSeconds: number,
  minActiveSeconds: number
): SilentRegion[] {
  if (durationSeconds <= 0 || minActiveSeconds <= 0) {
    return silentRegions
  }

  const activeRegions = invertRegions(silentRegions, durationSeconds)
  let expandedSilent = [...silentRegions]

  for (const active of activeRegions) {
    const duration = active.endSeconds - active.startSeconds
    if (duration > 0 && duration < minActiveSeconds) {
      expandedSilent.push({ ...active })
    }
  }

  return mergeAdjacentRegions(expandedSilent, 0.001)
}
