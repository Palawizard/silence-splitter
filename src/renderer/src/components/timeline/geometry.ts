const TARGET_VISIBLE_SECONDS = 15
export const RULER_HEIGHT = 22
export const SEGMENT_BAR_HEIGHT = 10
export const WAVE_LANE_HEIGHT = 88
export const TRACK_HEIGHT = RULER_HEIGHT + SEGMENT_BAR_HEIGHT + WAVE_LANE_HEIGHT
export const WAVE_LANE_TOP = RULER_HEIGHT + SEGMENT_BAR_HEIGHT

export function formatTimeLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0s'

  const totalSeconds = Math.floor(seconds)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60

  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  if (minutes > 0) return `${minutes}:${String(secs).padStart(2, '0')}`
  return `${secs}s`
}

export function buildTimeTicks(durationSeconds: number, pixelsPerSecond: number): number[] {
  if (durationSeconds <= 0) return [0]

  let step = 10
  if (pixelsPerSecond >= 20) step = 5
  if (pixelsPerSecond >= 40) step = 2
  if (pixelsPerSecond >= 60) step = 1

  const ticks: number[] = []
  for (let time = 0; time <= durationSeconds + step * 0.01; time += step) {
    ticks.push(Math.min(time, durationSeconds))
  }
  if (ticks[ticks.length - 1] !== durationSeconds) ticks.push(durationSeconds)
  return ticks
}

export function toX(seconds: number, pixelsPerSecond: number): number {
  return seconds * pixelsPerSecond
}

export function computePixelsPerSecond(duration: number, viewportWidth: number): number {
  if (viewportWidth <= 0) return 800 / TARGET_VISIBLE_SECONDS
  if (duration <= 0) return viewportWidth / TARGET_VISIBLE_SECONDS

  const targetPixelsPerSecond = viewportWidth / TARGET_VISIBLE_SECONDS
  return duration * targetPixelsPerSecond <= viewportWidth
    ? viewportWidth / duration
    : targetPixelsPerSecond
}

function readCssColor(variable: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
  return value || fallback
}

export function drawWindowWaveform(
  canvas: HTMLCanvasElement,
  peaks: number[],
  viewportWidth: number,
  maxHalfHeight: number
): void {
  const context = canvas.getContext('2d')
  if (!context || peaks.length === 0 || viewportWidth <= 0) return

  const devicePixelRatio = window.devicePixelRatio || 1
  const bitmapWidth = Math.ceil(viewportWidth)
  canvas.width = Math.ceil(bitmapWidth * devicePixelRatio)
  canvas.height = Math.ceil(WAVE_LANE_HEIGHT * devicePixelRatio)
  context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
  context.clearRect(0, 0, bitmapWidth, WAVE_LANE_HEIGHT)
  context.fillStyle = readCssColor('--color-timeline-waveform-bar', '#1e293b')

  const waveMidY = WAVE_LANE_HEIGHT / 2
  const columnCount = Math.min(peaks.length, bitmapWidth)
  const barWidth = bitmapWidth / columnCount

  for (let column = 0; column < columnCount; column++) {
    const peak = peaks[column]
    if (peak <= 0) continue

    const halfHeight = Math.max(1, peak * maxHalfHeight)
    const x = column * barWidth
    const width = Math.max(1, barWidth - (barWidth > 2 ? 0.2 : 0))
    context.fillRect(x, waveMidY - halfHeight, width, halfHeight * 2)
  }
}

export function peaksFromDecimatedEnvelope(
  waveform: { peaks: number[]; bucketCount: number },
  mediaDurationSeconds: number,
  startSeconds: number,
  endSeconds: number,
  targetBucketCount: number
): number[] {
  if (
    waveform.peaks.length === 0 ||
    waveform.bucketCount <= 0 ||
    mediaDurationSeconds <= 0 ||
    endSeconds <= startSeconds ||
    targetBucketCount <= 0
  ) return []

  const startBucket = Math.floor((startSeconds / mediaDurationSeconds) * waveform.bucketCount)
  const endBucket = Math.min(
    waveform.bucketCount,
    Math.max(startBucket + 1, Math.ceil((endSeconds / mediaDurationSeconds) * waveform.bucketCount))
  )
  const windowPeaks = waveform.peaks.slice(startBucket, endBucket)
  if (windowPeaks.length === 0) return []
  if (windowPeaks.length === targetBucketCount) return windowPeaks

  return Array.from({ length: targetBucketCount }, (_, index) => {
    const sourceIndex = Math.min(
      windowPeaks.length - 1,
      Math.floor((index / targetBucketCount) * windowPeaks.length)
    )
    return windowPeaks[sourceIndex] ?? 0
  })
}
