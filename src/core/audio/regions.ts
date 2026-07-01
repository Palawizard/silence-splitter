import {
  DETECTION_HOP_MS,
  DETECTION_WINDOW_MS,
  type SilentRegion
} from './types'
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
  windowMs: number = DETECTION_WINDOW_MS,
  hopMs: number = DETECTION_HOP_MS
): SilentRegion[] {
  if (rmsValues.length === 0) {
    return []
  }

  const rawMask = rmsValues.map((value) => windowIsSilent(value, threshold))
  const silentMask = stabilizeSilenceMask(rawMask)
  const regions: SilentRegion[] = []
  let regionStart: number | null = null

  for (let i = 0; i < rmsValues.length; i++) {
    const silent = silentMask[i]
    const boundary = windowCenterSeconds(i, sampleRate, windowMs, hopMs)

    if (silent && regionStart === null) {
      regionStart = i === 0 ? 0 : boundary
    } else if (!silent && regionStart !== null) {
      regions.push({ startSeconds: regionStart, endSeconds: boundary })
      regionStart = null
    }
  }

  if (regionStart !== null) {
    const analyzedEnd = rmsWindowDurationSeconds(
      rmsValues.length,
      sampleRate,
      windowMs,
      hopMs
    )
    regions.push({ startSeconds: regionStart, endSeconds: analyzedEnd })
  }

  return mergeAdjacentRegions(regions, 0.001)
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

/** Remove isolated 10 ms classification flips without shifting sustained boundaries. */
export function stabilizeSilenceMask(mask: boolean[]): boolean[] {
  if (mask.length < 3) {
    return [...mask]
  }

  const stabilized = [...mask]
  for (let i = 1; i < mask.length - 1; i++) {
    if (mask[i - 1] === mask[i + 1] && mask[i] !== mask[i - 1]) {
      stabilized[i] = mask[i - 1]
    }
  }
  return stabilized
}

const BRIEF_ACTIVITY_EXTENSION_SECONDS = 0.15
const BRIEF_ACTIVITY_MIN_MEDIAN_MARGIN_DB = 28

/**
 * Reject low-confidence clicks just above the minimum active duration.
 * Strong short words and game sounds remain active; marginal waveform bumps do not
 * create isolated keep segments that TimeBolt classifies as silence.
 */
export function suppressBriefMarginalActivity(
  levelValues: number[],
  threshold: number,
  minActiveSeconds: number,
  hopMs: number = DETECTION_HOP_MS
): number[] {
  if (levelValues.length === 0 || minActiveSeconds <= 0) {
    return levelValues
  }

  const silentMask = stabilizeSilenceMask(
    levelValues.map((value) => windowIsSilent(value, threshold))
  )
  const result = [...levelValues]
  const thresholdDb = rmsToDbFs(threshold)
  let activeStart: number | null = null

  for (let i = 0; i <= silentMask.length; i++) {
    const active = i < silentMask.length && !silentMask[i]
    if (active && activeStart === null) {
      activeStart = i
      continue
    }
    if (active || activeStart === null) {
      continue
    }

    const activeEnd = i
    const durationSeconds = ((activeEnd - activeStart) * hopMs) / 1000
    if (
      durationSeconds > minActiveSeconds &&
      durationSeconds <= minActiveSeconds + BRIEF_ACTIVITY_EXTENSION_SECONDS
    ) {
      const sortedDb = levelValues
        .slice(activeStart, activeEnd)
        .map(rmsToDbFs)
        .sort((a, b) => a - b)
      const medianDb = sortedDb[Math.floor(sortedDb.length / 2)]
      if (medianDb < thresholdDb + BRIEF_ACTIVITY_MIN_MEDIAN_MARGIN_DB) {
        result.fill(0, activeStart, activeEnd)
      }
    }
    activeStart = null
  }

  return result
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
    if (duration > 0 && duration <= minActiveSeconds + 1e-9) {
      expandedSilent.push({ ...active })
    }
  }

  return mergeAdjacentRegions(expandedSilent, 0.001)
}
