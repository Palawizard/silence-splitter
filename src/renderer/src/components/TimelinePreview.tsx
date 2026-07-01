import { useCallback, useEffect, useRef, useState } from 'react'
import type { TimelinePreviewData } from '@core/models/timeline-preview'
import { formatDuration } from '../utils/format'

type TimelinePreviewProps = {
  data: TimelinePreviewData
  durationSeconds: number
  filterBelowDb?: number | null
  onRequestWaveformWindow?: (
    startSeconds: number,
    endSeconds: number,
    bucketCount: number
  ) => Promise<{ peaks: number[] } | null>
}

const TRACK_HEIGHT = 110
const SEGMENT_BAR_HEIGHT = 14
const WAVE_LANE_TOP = SEGMENT_BAR_HEIGHT
const WAVE_LANE_HEIGHT = TRACK_HEIGHT - SEGMENT_BAR_HEIGHT
const TARGET_VISIBLE_SECONDS = 15
const WAVE_AMPLITUDE = 0.92

function formatTimeLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00'
  }

  const totalSeconds = Math.floor(seconds)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  const frac = Math.floor((seconds - totalSeconds) * 10)

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  if (minutes > 0) {
    return `${minutes}:${String(secs).padStart(2, '0')}`
  }

  if (frac > 0) {
    return `${secs}.${frac} s`
  }

  return `${secs} s`
}

function buildTimeTicks(durationSeconds: number, pixelsPerSecond: number): number[] {
  if (durationSeconds <= 0) {
    return [0]
  }

  let step = 10
  if (pixelsPerSecond >= 20) {
    step = 5
  }
  if (pixelsPerSecond >= 40) {
    step = 2
  }
  if (pixelsPerSecond >= 60) {
    step = 1
  }

  const ticks: number[] = []
  for (let t = 0; t <= durationSeconds + step * 0.01; t += step) {
    ticks.push(Math.min(t, durationSeconds))
  }

  if (ticks[ticks.length - 1] !== durationSeconds) {
    ticks.push(durationSeconds)
  }

  return ticks
}

function toX(seconds: number, pixelsPerSecond: number): number {
  return seconds * pixelsPerSecond
}

function computePixelsPerSecond(duration: number, viewportWidth: number): number {
  if (viewportWidth <= 0) {
    return 800 / TARGET_VISIBLE_SECONDS
  }

  if (duration <= 0) {
    return viewportWidth / TARGET_VISIBLE_SECONDS
  }

  const targetPps = viewportWidth / TARGET_VISIBLE_SECONDS

  if (duration * targetPps <= viewportWidth) {
    return viewportWidth / duration
  }

  return targetPps
}

function drawWindowWaveform(
  canvas: HTMLCanvasElement,
  peaks: number[],
  viewportWidth: number,
  waveMidY: number,
  maxHalfHeight: number
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx || peaks.length === 0 || viewportWidth <= 0) {
    return
  }

  const dpr = window.devicePixelRatio || 1
  const bitmapWidth = Math.ceil(viewportWidth)
  canvas.width = Math.ceil(bitmapWidth * dpr)
  canvas.height = Math.ceil(TRACK_HEIGHT * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, bitmapWidth, TRACK_HEIGHT)
  ctx.fillStyle = '#1e293b'

  const columnCount = Math.min(peaks.length, bitmapWidth)
  const barWidth = bitmapWidth / columnCount

  for (let col = 0; col < columnCount; col++) {
    const peak = peaks[col]
    if (peak <= 0) {
      continue
    }

    const halfHeight = Math.max(1, peak * maxHalfHeight)
    const x = col * barWidth
    const width = Math.max(1, barWidth - (barWidth > 2 ? 0.2 : 0))
    ctx.fillRect(x, waveMidY - halfHeight, width, halfHeight * 2)
  }
}

export default function TimelinePreview({
  data,
  durationSeconds,
  filterBelowDb,
  onRequestWaveformWindow
}: TimelinePreviewProps) {
  const { keepRegions, cutRegions, segmentCount, keptDurationSeconds, cutDurationSeconds } = data

  const viewportRef = useRef<HTMLDivElement>(null)
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null)
  const scrollRafRef = useRef<number | null>(null)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [windowPeaks, setWindowPeaks] = useState<number[]>([])

  const pixelsPerSecond = computePixelsPerSecond(durationSeconds, viewportWidth)
  const canvasWidth = Math.max(Math.ceil(durationSeconds * pixelsPerSecond), 1)
  const ticks = buildTimeTicks(durationSeconds, pixelsPerSecond)
  const waveMidY = WAVE_LANE_TOP + WAVE_LANE_HEIGHT / 2
  const maxHalfHeight = (WAVE_LANE_HEIGHT / 2) * WAVE_AMPLITUDE
  const maxScroll = Math.max(0, canvasWidth - viewportWidth)

  const readVisibleRange = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport || viewportWidth <= 0 || pixelsPerSecond <= 0) {
      return { startSeconds: 0, endSeconds: 0, scrollPx: 0 }
    }

    const scrollPx = viewport.scrollLeft
    const startSeconds = scrollPx / pixelsPerSecond
    const endSeconds = Math.min(
      durationSeconds,
      (scrollPx + viewportWidth) / pixelsPerSecond
    )

    return { startSeconds, endSeconds, scrollPx }
  }, [durationSeconds, viewportWidth, pixelsPerSecond])

  const viewStartSeconds = scrollLeft / pixelsPerSecond
  const viewEndSeconds = Math.min(
    durationSeconds,
    (scrollLeft + viewportWidth) / pixelsPerSecond
  )

  const updateViewportWidth = useCallback(() => {
    if (viewportRef.current) {
      setViewportWidth(viewportRef.current.clientWidth)
    }
  }, [])

  const syncScrollLeft = useCallback(() => {
    if (viewportRef.current) {
      setScrollLeft(viewportRef.current.scrollLeft)
    }
  }, [])

  useEffect(() => {
    setScrollLeft(0)
    setWindowPeaks([])
    if (viewportRef.current) {
      viewportRef.current.scrollLeft = 0
    }
  }, [data, durationSeconds])

  useEffect(() => {
    updateViewportWidth()
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    const observer = new ResizeObserver(updateViewportWidth)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [updateViewportWidth])

  useEffect(() => {
    if (scrollLeft > maxScroll) {
      const next = maxScroll
      setScrollLeft(next)
      if (viewportRef.current) {
        viewportRef.current.scrollLeft = next
      }
    }
  }, [scrollLeft, maxScroll])

  const refreshWindowPeaks = useCallback(() => {
    if (!onRequestWaveformWindow || viewportWidth <= 0 || durationSeconds <= 0) {
      return
    }

    const { startSeconds, endSeconds } = readVisibleRange()
    if (endSeconds <= startSeconds) {
      return
    }

    const bucketCount = Math.max(100, Math.ceil(viewportWidth))
    void onRequestWaveformWindow(startSeconds, endSeconds, bucketCount).then((envelope) => {
      if (envelope) {
        setWindowPeaks(envelope.peaks)
      }
    })
  }, [onRequestWaveformWindow, viewportWidth, durationSeconds, readVisibleRange])

  useEffect(() => {
    const timer = window.setTimeout(refreshWindowPeaks, 80)
    return () => window.clearTimeout(timer)
  }, [refreshWindowPeaks, scrollLeft])

  useEffect(() => {
    const canvas = waveformCanvasRef.current
    if (!canvas || windowPeaks.length === 0 || viewportWidth <= 0) {
      return
    }

    drawWindowWaveform(canvas, windowPeaks, viewportWidth, waveMidY, maxHalfHeight)
  }, [windowPeaks, viewportWidth, waveMidY, maxHalfHeight])

  const handleScroll = () => {
    if (scrollRafRef.current !== null) {
      return
    }

    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null
      syncScrollLeft()
    })
  }

  const handleSliderChange = (value: number) => {
    const clamped = Math.min(maxScroll, Math.max(0, value))
    if (viewportRef.current) {
      viewportRef.current.scrollLeft = clamped
    }
    setScrollLeft(clamped)
  }

  const waveformLeft = scrollLeft

  const showNavigator = maxScroll > 4

  return (
    <div className="timeline-preview">
      <div className="timeline-summary">
        <span>
          {segmentCount} segment{segmentCount !== 1 ? 's' : ''} conservé
          {segmentCount !== 1 ? 's' : ''}
        </span>
        <span className="timeline-summary-sep">·</span>
        <span>
          {formatDuration(keptDurationSeconds)} gardé{keptDurationSeconds !== 1 ? 's' : ''}
        </span>
        <span className="timeline-summary-sep">·</span>
        <span>
          {formatDuration(cutDurationSeconds)} coupé{cutDurationSeconds !== 1 ? 's' : ''}
        </span>
        {filterBelowDb !== null && filterBelowDb !== undefined && (
          <>
            <span className="timeline-summary-sep">·</span>
            <span>Seuil {filterBelowDb.toFixed(0)} dB</span>
          </>
        )}
      </div>

      <div
        ref={viewportRef}
        className="timeline-viewport"
        onScroll={handleScroll}
        tabIndex={0}
        role="region"
        aria-label="Aperçu zoomé de la timeline"
      >
        <div className="timeline-canvas" style={{ width: canvasWidth }}>
          <svg
            className="timeline-track"
            width={canvasWidth}
            height={TRACK_HEIGHT}
            viewBox={`0 0 ${canvasWidth} ${TRACK_HEIGHT}`}
            preserveAspectRatio="none"
            role="img"
            aria-hidden="true"
          >
            <rect x={0} y={0} width={canvasWidth} height={TRACK_HEIGHT} className="timeline-background" />

            {cutRegions.map((region, index) => (
              <rect
                key={`cut-fill-${index}`}
                x={toX(region.startSeconds, pixelsPerSecond)}
                y={WAVE_LANE_TOP}
                width={Math.max(1, toX(region.endSeconds - region.startSeconds, pixelsPerSecond))}
                height={WAVE_LANE_HEIGHT}
                className="timeline-cut-zone"
              />
            ))}

            {keepRegions.map((region, index) => (
              <rect
                key={`keep-fill-${index}`}
                x={toX(region.startSeconds, pixelsPerSecond)}
                y={WAVE_LANE_TOP}
                width={Math.max(1, toX(region.endSeconds - region.startSeconds, pixelsPerSecond))}
                height={WAVE_LANE_HEIGHT}
                className="timeline-keep-zone"
              />
            ))}

            {cutRegions.map((region, index) => (
              <rect
                key={`cut-bar-${index}`}
                x={toX(region.startSeconds, pixelsPerSecond)}
                y={0}
                width={Math.max(1, toX(region.endSeconds - region.startSeconds, pixelsPerSecond))}
                height={SEGMENT_BAR_HEIGHT}
                className="timeline-cut-marker"
              />
            ))}

            {keepRegions.map((region, index) => (
              <rect
                key={`keep-bar-${index}`}
                x={toX(region.startSeconds, pixelsPerSecond)}
                y={0}
                width={Math.max(1, toX(region.endSeconds - region.startSeconds, pixelsPerSecond))}
                height={SEGMENT_BAR_HEIGHT}
                className="timeline-keep-marker"
              />
            ))}
          </svg>

          {viewportWidth > 0 && (
            <canvas
              ref={waveformCanvasRef}
              className="timeline-waveform-canvas"
              style={{
                left: waveformLeft,
                width: viewportWidth,
                height: TRACK_HEIGHT
              }}
              aria-hidden="true"
            />
          )}

          <div className="timeline-scale" style={{ width: canvasWidth }}>
            {ticks.map((tick, index) => (
              <span
                key={`tick-${index}`}
                className="timeline-tick"
                style={{ left: toX(tick, pixelsPerSecond) }}
              >
                {formatTimeLabel(tick)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {showNavigator && (
        <div className="timeline-nav">
          <label className="timeline-nav-label" htmlFor="timeline-position">
            Position
          </label>
          <input
            id="timeline-position"
            type="range"
            className="timeline-nav-slider"
            min={0}
            max={maxScroll}
            step={1}
            value={scrollLeft}
            onChange={(e) => handleSliderChange(Number(e.target.value))}
          />
          <span className="timeline-nav-time">
            {formatTimeLabel(viewStartSeconds)} – {formatTimeLabel(viewEndSeconds)}
          </span>
        </div>
      )}
    </div>
  )
}
