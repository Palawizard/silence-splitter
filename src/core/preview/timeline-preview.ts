import type { KeepSegment } from '@core/models/keep-segment'
import type { TimelinePreviewData, TimeRegion } from '@core/models/timeline-preview'
import type { WaveformEnvelope } from '@core/models/waveform-envelope'
import { clampTimeRange } from '@core/time'

function keepRegionsFromSegments(segments: KeepSegment[]): TimeRegion[] {
  return segments.map((segment) => ({
    startSeconds: segment.sourceStartSeconds,
    endSeconds: segment.sourceEndSeconds
  }))
}

/** Derive cut gaps between keep segments, clamped to media duration. */
export function deriveCutRegions(
  keepSegments: KeepSegment[],
  durationSeconds: number
): TimeRegion[] {
  if (durationSeconds <= 0) {
    return []
  }

  if (keepSegments.length === 0) {
    return [{ startSeconds: 0, endSeconds: durationSeconds }]
  }

  const sorted = [...keepSegments].sort((a, b) => a.sourceStartSeconds - b.sourceStartSeconds)
  const cuts: TimeRegion[] = []
  let cursor = 0

  for (const segment of sorted) {
    if (segment.sourceStartSeconds > cursor) {
      const gap = clampTimeRange(cursor, segment.sourceStartSeconds, durationSeconds)
      if (gap.endSeconds - gap.startSeconds > 0) {
        cuts.push(gap)
      }
    }
    cursor = Math.max(cursor, segment.sourceEndSeconds)
  }

  if (cursor < durationSeconds) {
    const tail = clampTimeRange(cursor, durationSeconds, durationSeconds)
    if (tail.endSeconds - tail.startSeconds > 0) {
      cuts.push(tail)
    }
  }

  return cuts
}

export function sumRegionDurations(regions: TimeRegion[]): number {
  return regions.reduce((sum, region) => sum + (region.endSeconds - region.startSeconds), 0)
}

/**
 * Build read-only timeline preview from the same keep segments used for export.
 * Does not mutate source media or segments.
 */
export function buildTimelinePreviewData(
  keepSegments: KeepSegment[],
  durationSeconds: number,
  waveform: WaveformEnvelope
): TimelinePreviewData {
  const keepRegions = keepRegionsFromSegments(keepSegments)
  const cutRegions = deriveCutRegions(keepSegments, durationSeconds)
  const keptDurationSeconds = sumRegionDurations(keepRegions)
  const cutDurationSeconds = sumRegionDurations(cutRegions)

  return {
    keepRegions,
    cutRegions,
    segmentCount: keepSegments.length,
    keptDurationSeconds,
    cutDurationSeconds,
    waveform
  }
}
