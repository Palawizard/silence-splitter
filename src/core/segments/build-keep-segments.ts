import type { KeepSegment } from '@core/models/keep-segment'
import type { DetectionParams } from '@core/presets'
import { clampTimeRange } from '@core/time'
import type { SilentRegion } from '@core/audio/types'
import { mergeAdjacentRegions } from '@core/audio/regions'

function regionDuration(region: SilentRegion): number {
  return Math.max(0, region.endSeconds - region.startSeconds)
}

/** Keep only silent regions long enough to be cut (Timebolt: remove silences longer than X). */
export function filterSilentRegions(
  regions: SilentRegion[],
  params: DetectionParams
): SilentRegion[] {
  return regions.filter((region) => {
    const duration = regionDuration(region)
    return duration >= params.removeSilencesLongerThanSeconds
  })
}

type PlainRegion = { startSeconds: number; endSeconds: number }

function invertToKeepRegions(
  cutRegions: SilentRegion[],
  durationSeconds: number
): PlainRegion[] {
  if (durationSeconds <= 0) {
    return []
  }

  const sorted = [...cutRegions].sort((a, b) => a.startSeconds - b.startSeconds)
  const keep: PlainRegion[] = []
  let cursor = 0

  for (const cut of sorted) {
    if (cut.startSeconds > cursor) {
      keep.push({ startSeconds: cursor, endSeconds: cut.startSeconds })
    }
    cursor = Math.max(cursor, cut.endSeconds)
  }

  if (cursor < durationSeconds) {
    keep.push({ startSeconds: cursor, endSeconds: durationSeconds })
  }

  return keep
}

function applyPadding(
  regions: PlainRegion[],
  params: DetectionParams,
  durationSeconds: number
): PlainRegion[] {
  return regions.map((region) => {
    const padded = clampTimeRange(
      region.startSeconds - params.leftPaddingSeconds,
      region.endSeconds + params.rightPaddingSeconds,
      durationSeconds
    )
    return padded
  })
}

function assignTimelinePositions(
  sourceRegions: PlainRegion[]
): KeepSegment[] {
  let timelineCursor = 0
  const segments: KeepSegment[] = []

  for (const region of sourceRegions) {
    const sourceDuration = region.endSeconds - region.startSeconds
    if (sourceDuration <= 0) {
      continue
    }

    segments.push({
      sourceStartSeconds: region.startSeconds,
      sourceEndSeconds: region.endSeconds,
      timelineStartSeconds: timelineCursor,
      timelineEndSeconds: timelineCursor + sourceDuration
    })
    timelineCursor += sourceDuration
  }

  return segments
}

/**
 * Build export-ready keep segments from raw silent regions and user params.
 * Preview and XML export both consume this same output.
 */
export function buildKeepSegments(
  durationSeconds: number,
  rawSilentRegions: SilentRegion[],
  params: DetectionParams
): KeepSegment[] {
  if (durationSeconds <= 0) {
    return []
  }

  const cutRegions = filterSilentRegions(rawSilentRegions, params)

  if (cutRegions.length === 0) {
    return assignTimelinePositions([{ startSeconds: 0, endSeconds: durationSeconds }])
  }

  let keepRegions = invertToKeepRegions(cutRegions, durationSeconds)
  keepRegions = applyPadding(keepRegions, params, durationSeconds)
  keepRegions = mergeAdjacentRegions(keepRegions, 0.001)

  keepRegions = keepRegions
    .map((region) => clampTimeRange(region.startSeconds, region.endSeconds, durationSeconds))
    .filter((region) => region.endSeconds - region.startSeconds > 0)

  if (keepRegions.length === 0) {
    return []
  }

  return assignTimelinePositions(keepRegions)
}
