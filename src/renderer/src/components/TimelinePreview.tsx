import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { Loader2, Pause, Play, Square } from 'lucide-react'
import {
  cutTimelineDuration,
  PLAYBACK_SAMPLE_RATE,
  sourceTimeToTimelineTime,
  timelineTimeToSourceTime
} from '@core/playback'
import type { KeepSegment } from '@core/models/keep-segment'
import type { TimelinePreviewData } from '@core/models/timeline-preview'
import { formatDuration } from '../utils/format'

type TimelinePreviewProps = {
  data: TimelinePreviewData
  durationSeconds: number
  filterBelowDb?: number | null
  filePath: string
  audioStreamIndices: number[]
  keepSegments: KeepSegment[]
  onRequestWaveformWindow?: (
    startSeconds: number,
    endSeconds: number,
    bucketCount: number
  ) => Promise<{ peaks: number[] } | null>
}

const CHUNK_DURATION_SECONDS = 20
const RULER_HEIGHT = 22
const SEGMENT_BAR_HEIGHT = 10
const WAVE_LANE_HEIGHT = 88
const TRACK_HEIGHT = RULER_HEIGHT + SEGMENT_BAR_HEIGHT + WAVE_LANE_HEIGHT
const WAVE_LANE_TOP = RULER_HEIGHT + SEGMENT_BAR_HEIGHT
const TARGET_VISIBLE_SECONDS = 15
const WAVE_AMPLITUDE = 0.92
const PLAYHEAD_LEFT_MARGIN_RATIO = 0.06
const PLAYHEAD_RIGHT_EDGE_RATIO = 0.94
const PLAYBACK_LABEL_INTERVAL_MS = 100

function formatTimeLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0s'
  }

  const totalSeconds = Math.floor(seconds)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  if (minutes > 0) {
    return `${minutes}:${String(secs).padStart(2, '0')}`
  }

  return `${secs}s`
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

function readCssColor(variable: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
  return value || fallback
}

function drawWindowWaveform(
  canvas: HTMLCanvasElement,
  peaks: number[],
  viewportWidth: number,
  maxHalfHeight: number
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx || peaks.length === 0 || viewportWidth <= 0) {
    return
  }

  const dpr = window.devicePixelRatio || 1
  const bitmapWidth = Math.ceil(viewportWidth)
  canvas.width = Math.ceil(bitmapWidth * dpr)
  canvas.height = Math.ceil(WAVE_LANE_HEIGHT * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, bitmapWidth, WAVE_LANE_HEIGHT)
  ctx.fillStyle = readCssColor('--color-timeline-waveform-bar', '#1e293b')

  const waveMidY = WAVE_LANE_HEIGHT / 2
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

function peaksFromDecimatedEnvelope(
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
  ) {
    return []
  }

  const startBucket = Math.floor((startSeconds / mediaDurationSeconds) * waveform.bucketCount)
  const endBucket = Math.min(
    waveform.bucketCount,
    Math.max(startBucket + 1, Math.ceil((endSeconds / mediaDurationSeconds) * waveform.bucketCount))
  )
  const windowPeaks = waveform.peaks.slice(startBucket, endBucket)
  if (windowPeaks.length === 0) {
    return []
  }

  if (windowPeaks.length === targetBucketCount) {
    return windowPeaks
  }

  const resampled = new Array<number>(targetBucketCount)
  for (let index = 0; index < targetBucketCount; index++) {
    const sourceIndex = Math.min(
      windowPeaks.length - 1,
      Math.floor((index / targetBucketCount) * windowPeaks.length)
    )
    resampled[index] = windowPeaks[sourceIndex] ?? 0
  }

  return resampled
}

export default function TimelinePreview({
  data,
  durationSeconds,
  filterBelowDb,
  filePath,
  audioStreamIndices,
  keepSegments,
  onRequestWaveformWindow
}: TimelinePreviewProps) {
  const { keepRegions, cutRegions, segmentCount, keptDurationSeconds, cutDurationSeconds } = data
  const cutDuration = cutTimelineDuration(keepSegments)

  const viewportRef = useRef<HTMLDivElement>(null)
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  const scrollRafRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const activeSourcesRef = useRef(new Set<AudioBufferSourceNode>())
  const generationRef = useRef(0)
  const isPlayingRef = useRef(false)
  const anchorContextTimeRef = useRef(0)
  const anchorTimelineTimeRef = useRef(0)
  const nextTimelineTimeRef = useRef(0)
  const nextScheduleTimeRef = useRef(0)
  const scheduledCountRef = useRef(0)
  const reachedEndRef = useRef(false)
  const fillingGenerationRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const positionRef = useRef(0)
  const userScrolledRef = useRef(false)
  const programmaticScrollRef = useRef(false)
  const waveformRequestRef = useRef(0)
  const hiresWaveformTimerRef = useRef<number | null>(null)
  const lastWaveformWindowRef = useRef({ start: -1, end: -1 })
  const pixelsPerSecondRef = useRef(0)
  const keepSegmentsRef = useRef(keepSegments)
  const cutDurationRef = useRef(cutDuration)
  const lastPlaybackLabelUpdateRef = useRef(0)

  const [viewportWidth, setViewportWidth] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [windowPeaks, setWindowPeaks] = useState<number[]>([])
  const [playbackPositionSeconds, setPlaybackPositionSeconds] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPlaybackPreparing, setIsPlaybackPreparing] = useState(false)
  const [playbackError, setPlaybackError] = useState<string | null>(null)

  const pixelsPerSecond = computePixelsPerSecond(durationSeconds, viewportWidth)
  const canvasWidth = Math.max(Math.ceil(durationSeconds * pixelsPerSecond), 1)
  const ticks = buildTimeTicks(durationSeconds, pixelsPerSecond)
  const maxHalfHeight = (WAVE_LANE_HEIGHT / 2) * WAVE_AMPLITUDE
  const maxScroll = Math.max(0, canvasWidth - viewportWidth)

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

  const updatePlayheadVisual = useCallback((timelinePositionSeconds: number) => {
    const playhead = playheadRef.current
    if (!playhead || pixelsPerSecondRef.current <= 0) {
      return
    }

    const visible =
      cutDurationRef.current > 0 &&
      (timelinePositionSeconds > 0 || isPlayingRef.current)
    playhead.style.visibility = visible ? 'visible' : 'hidden'
    if (!visible) {
      return
    }

    const sourceSeconds = timelineTimeToSourceTime(
      keepSegmentsRef.current,
      timelinePositionSeconds
    )
    playhead.style.transform = `translate3d(${sourceSeconds * pixelsPerSecondRef.current}px, 0, 0)`
  }, [])

  const syncPlaybackDisplay = useCallback(
    (timelinePositionSeconds: number, forceLabel = false) => {
      updatePlayheadVisual(timelinePositionSeconds)
      const now = performance.now()
      if (
        forceLabel ||
        now - lastPlaybackLabelUpdateRef.current >= PLAYBACK_LABEL_INTERVAL_MS
      ) {
        lastPlaybackLabelUpdateRef.current = now
        setPlaybackPositionSeconds(timelinePositionSeconds)
      }
    },
    [updatePlayheadVisual]
  )

  pixelsPerSecondRef.current = pixelsPerSecond
  keepSegmentsRef.current = keepSegments
  cutDurationRef.current = cutDuration

  useEffect(() => {
    updatePlayheadVisual(positionRef.current)
  }, [pixelsPerSecond, keepSegments, cutDuration, updatePlayheadVisual])

  useEffect(() => {
    setScrollLeft(0)
    setWindowPeaks([])
    setPlaybackPositionSeconds(0)
    positionRef.current = 0
    lastPlaybackLabelUpdateRef.current = 0
    userScrolledRef.current = false
    if (viewportRef.current) {
      viewportRef.current.scrollLeft = 0
    }
    updatePlayheadVisual(0)
  }, [data, durationSeconds, keepSegments, filePath, audioStreamIndices, updatePlayheadVisual])

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
    const observer = new MutationObserver(() => {
      const canvas = waveformCanvasRef.current
      if (canvas && windowPeaks.length > 0 && viewportWidth > 0) {
        drawWindowWaveform(canvas, windowPeaks, viewportWidth, maxHalfHeight)
      }
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    })

    return () => observer.disconnect()
  }, [windowPeaks, viewportWidth, maxHalfHeight])

  useEffect(() => {
    if (scrollLeft > maxScroll) {
      const next = maxScroll
      setScrollLeft(next)
      if (viewportRef.current) {
        viewportRef.current.scrollLeft = next
      }
    }
  }, [scrollLeft, maxScroll])

  const applyVisiblePeaks = useCallback(
    (peaks: number[]) => {
      setWindowPeaks(peaks)
      const canvas = waveformCanvasRef.current
      if (canvas && peaks.length > 0 && viewportWidth > 0) {
        drawWindowWaveform(canvas, peaks, viewportWidth, maxHalfHeight)
      }
    },
    [maxHalfHeight, viewportWidth]
  )

  const readViewportRange = useCallback(
    (scrollPx: number) => {
      if (viewportWidth <= 0 || pixelsPerSecond <= 0) {
        return { startSeconds: 0, endSeconds: 0 }
      }

      const startSeconds = scrollPx / pixelsPerSecond
      const endSeconds = Math.min(
        durationSeconds,
        (scrollPx + viewportWidth) / pixelsPerSecond
      )

      return { startSeconds, endSeconds }
    },
    [durationSeconds, pixelsPerSecond, viewportWidth]
  )

  const updateWaveformForViewport = useCallback(
    (scrollPx: number, fetchHires = true) => {
      if (viewportWidth <= 0 || durationSeconds <= 0) {
        return
      }

      const { startSeconds, endSeconds } = readViewportRange(scrollPx)
      if (endSeconds <= startSeconds) {
        return
      }

      const lastWindow = lastWaveformWindowRef.current
      const windowMoved =
        Math.abs(lastWindow.start - startSeconds) > 0.05 ||
        Math.abs(lastWindow.end - endSeconds) > 0.05

      if (!windowMoved && windowPeaks.length > 0) {
        return
      }

      lastWaveformWindowRef.current = { start: startSeconds, end: endSeconds }
      const bucketCount = Math.max(100, Math.ceil(viewportWidth))
      applyVisiblePeaks(
        peaksFromDecimatedEnvelope(
          data.waveform,
          durationSeconds,
          startSeconds,
          endSeconds,
          bucketCount
        )
      )

      if (!fetchHires || !onRequestWaveformWindow) {
        return
      }

      if (hiresWaveformTimerRef.current !== null) {
        window.clearTimeout(hiresWaveformTimerRef.current)
      }

      hiresWaveformTimerRef.current = window.setTimeout(() => {
        hiresWaveformTimerRef.current = null
        const requestId = ++waveformRequestRef.current
        void onRequestWaveformWindow(startSeconds, endSeconds, bucketCount).then((envelope) => {
          if (requestId !== waveformRequestRef.current || !envelope) {
            return
          }

          applyVisiblePeaks(envelope.peaks)
        })
      }, 32)
    },
    [
      applyVisiblePeaks,
      data.waveform,
      durationSeconds,
      onRequestWaveformWindow,
      readViewportRange,
      viewportWidth
    ]
  )

  const refreshWindowPeaks = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    updateWaveformForViewport(viewport.scrollLeft, true)
  }, [updateWaveformForViewport])

  useEffect(() => {
    lastWaveformWindowRef.current = { start: -1, end: -1 }
    refreshWindowPeaks()
  }, [refreshWindowPeaks, data, durationSeconds, viewportWidth])

  const scrollToSourceTime = useCallback(
    (sourceSeconds: number, policy: 'playback' | 'reveal' | 'start') => {
      const viewport = viewportRef.current
      if (!viewport || viewportWidth <= 0) {
        return
      }

      const playheadPx = toX(sourceSeconds, pixelsPerSecond)
      const scrollPx = viewport.scrollLeft
      const leftMargin = viewportWidth * PLAYHEAD_LEFT_MARGIN_RATIO
      const rightEdgePx = scrollPx + viewportWidth * PLAYHEAD_RIGHT_EDGE_RATIO

      let target: number | null = null

      if (policy === 'start') {
        target = 0
      } else if (policy === 'reveal') {
        const visibleLeft = scrollPx
        const visibleRight = scrollPx + viewportWidth
        if (playheadPx >= visibleLeft && playheadPx <= visibleRight) {
          return
        }
        target = Math.min(maxScroll, Math.max(0, playheadPx - leftMargin))
      } else {
        if (playheadPx > rightEdgePx) {
          target = Math.min(maxScroll, playheadPx - leftMargin)
        } else if (playheadPx < scrollPx) {
          target = Math.max(0, playheadPx - leftMargin)
        } else {
          return
        }
      }

      if (Math.abs(scrollPx - target) < 1) {
        return
      }

      programmaticScrollRef.current = true
      viewport.scrollLeft = target
      setScrollLeft(target)
      updateWaveformForViewport(target, !isPlayingRef.current)
    },
    [maxScroll, pixelsPerSecond, updateWaveformForViewport, viewportWidth]
  )

  useEffect(
    () => () => {
      if (hiresWaveformTimerRef.current !== null) {
        window.clearTimeout(hiresWaveformTimerRef.current)
      }
    },
    []
  )

  const stopScheduledAudio = useCallback(() => {
    generationRef.current++
    for (const source of activeSourcesRef.current) {
      source.onended = null
      try {
        source.stop()
      } catch {
        // The source may already have ended.
      }
      source.disconnect()
    }
    activeSourcesRef.current.clear()
    scheduledCountRef.current = 0
    reachedEndRef.current = false
    fillingGenerationRef.current = null
  }, [])

  const readCurrentPosition = useCallback(() => {
    const context = audioContextRef.current
    if (!context || !isPlayingRef.current) {
      return positionRef.current
    }

    return Math.min(
      cutDuration,
      anchorTimelineTimeRef.current +
        Math.max(0, context.currentTime - anchorContextTimeRef.current)
    )
  }, [cutDuration])

  const finishPlayback = useCallback(() => {
    isPlayingRef.current = false
    setIsPlaying(false)
    positionRef.current = cutDuration
    syncPlaybackDisplay(cutDuration, true)
  }, [cutDuration, syncPlaybackDisplay])

  const fillQueueRef = useRef<(generation: number) => Promise<void>>(async () => undefined)

  fillQueueRef.current = async (generation: number) => {
    if (fillingGenerationRef.current === generation || generation !== generationRef.current) {
      return
    }

    const context = audioContextRef.current
    if (!context) {
      setIsPlaybackPreparing(false)
      return
    }

    fillingGenerationRef.current = generation
    try {
      while (
        generation === generationRef.current &&
        isPlayingRef.current &&
        scheduledCountRef.current < 2 &&
        !reachedEndRef.current
      ) {
        const chunk = await window.api.getPlaybackChunk({
          filePath,
          durationSeconds,
          audioStreamIndices,
          keepSegments,
          timelineStartSeconds: nextTimelineTimeRef.current,
          chunkDurationSeconds: CHUNK_DURATION_SECONDS
        })
        if (generation !== generationRef.current || !isPlayingRef.current) {
          setIsPlaybackPreparing(false)
          return
        }
        setIsPlaybackPreparing(false)
        if (chunk.durationSeconds <= 0 || chunk.samples.byteLength === 0) {
          finishPlayback()
          return
        }

        const samples = new Float32Array(chunk.samples)
        const buffer = context.createBuffer(1, samples.length, chunk.sampleRate)
        buffer.copyToChannel(samples, 0)
        const source = context.createBufferSource()
        source.buffer = buffer
        source.connect(context.destination)

        const scheduleTime = Math.max(nextScheduleTimeRef.current, context.currentTime + 0.03)
        if (scheduledCountRef.current === 0) {
          anchorContextTimeRef.current = scheduleTime
          anchorTimelineTimeRef.current = chunk.timelineStartSeconds
          setIsPlaying(true)
        }

        source.onended = () => {
          activeSourcesRef.current.delete(source)
          scheduledCountRef.current = Math.max(0, scheduledCountRef.current - 1)
          source.disconnect()
          if (generation !== generationRef.current || !isPlayingRef.current) {
            return
          }
          if (reachedEndRef.current && scheduledCountRef.current === 0) {
            finishPlayback()
            return
          }
          void fillQueueRef.current(generation)
        }

        source.start(scheduleTime)
        activeSourcesRef.current.add(source)
        scheduledCountRef.current++
        nextScheduleTimeRef.current = scheduleTime + chunk.durationSeconds
        nextTimelineTimeRef.current = chunk.timelineStartSeconds + chunk.durationSeconds
        reachedEndRef.current = chunk.ended
      }
    } catch {
      if (generation === generationRef.current) {
        stopScheduledAudio()
        isPlayingRef.current = false
        setIsPlaying(false)
        setIsPlaybackPreparing(false)
        setPlaybackError("Impossible de lire l'aperçu audio.")
      }
    } finally {
      if (fillingGenerationRef.current === generation) {
        fillingGenerationRef.current = null
      }
    }
  }

  const startPlayback = useCallback(
    async (requestedPosition: number) => {
      stopScheduledAudio()
      const startPosition = requestedPosition >= cutDuration ? 0 : requestedPosition
      const context =
        audioContextRef.current ?? new AudioContext({ sampleRate: PLAYBACK_SAMPLE_RATE })
      audioContextRef.current = context
      await context.resume()

      const generation = generationRef.current
      isPlayingRef.current = true
      userScrolledRef.current = false
      setIsPlaybackPreparing(true)
      setIsPlaying(false)
      setPlaybackError(null)
      positionRef.current = startPosition
      syncPlaybackDisplay(startPosition, true)
      nextTimelineTimeRef.current = startPosition
      nextScheduleTimeRef.current = context.currentTime + 0.05
      anchorTimelineTimeRef.current = startPosition
      anchorContextTimeRef.current = nextScheduleTimeRef.current
      scrollToSourceTime(timelineTimeToSourceTime(keepSegments, startPosition), 'reveal')
      void fillQueueRef.current(generation)
    },
    [cutDuration, keepSegments, scrollToSourceTime, stopScheduledAudio, syncPlaybackDisplay]
  )

  const pausePlayback = useCallback(() => {
    const currentPosition = readCurrentPosition()
    stopScheduledAudio()
    isPlayingRef.current = false
    setIsPlaying(false)
    setIsPlaybackPreparing(false)
    positionRef.current = currentPosition
    syncPlaybackDisplay(currentPosition, true)
  }, [readCurrentPosition, stopScheduledAudio, syncPlaybackDisplay])

  const stopPlayback = useCallback(() => {
    stopScheduledAudio()
    isPlayingRef.current = false
    setIsPlaying(false)
    setIsPlaybackPreparing(false)
    positionRef.current = 0
    setPlaybackPositionSeconds(0)
    lastPlaybackLabelUpdateRef.current = 0
    updatePlayheadVisual(0)
    userScrolledRef.current = false
    scrollToSourceTime(0, 'start')
  }, [scrollToSourceTime, stopScheduledAudio, updatePlayheadVisual])

  const seekToTimelinePosition = useCallback(
    (nextPosition: number) => {
      const clamped = Math.min(cutDuration, Math.max(0, nextPosition))
      userScrolledRef.current = false
      if (isPlayingRef.current) {
        void startPlayback(clamped)
        return
      }

      positionRef.current = clamped
      syncPlaybackDisplay(clamped, true)
      scrollToSourceTime(timelineTimeToSourceTime(keepSegments, clamped), 'reveal')
    },
    [cutDuration, keepSegments, scrollToSourceTime, startPlayback, syncPlaybackDisplay]
  )

  useEffect(() => {
    if (!isPlaying) {
      return
    }

    const updatePosition = () => {
      const currentPosition = readCurrentPosition()
      positionRef.current = currentPosition
      syncPlaybackDisplay(currentPosition)

      if (!userScrolledRef.current) {
        scrollToSourceTime(
          timelineTimeToSourceTime(keepSegments, currentPosition),
          'playback'
        )
      }

      animationFrameRef.current = window.requestAnimationFrame(updatePosition)
    }
    animationFrameRef.current = window.requestAnimationFrame(updatePosition)
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [isPlaying, keepSegments, readCurrentPosition, scrollToSourceTime, syncPlaybackDisplay])

  useEffect(() => {
    stopScheduledAudio()
    isPlayingRef.current = false
    setIsPlaying(false)
    setIsPlaybackPreparing(false)
    positionRef.current = 0
    setPlaybackPositionSeconds(0)
    lastPlaybackLabelUpdateRef.current = 0
    updatePlayheadVisual(0)
    setPlaybackError(null)
  }, [filePath, audioStreamIndices, keepSegments, stopScheduledAudio, updatePlayheadVisual])

  useEffect(
    () => () => {
      stopScheduledAudio()
      void audioContextRef.current?.close()
    },
    [stopScheduledAudio]
  )

  const handleScroll = () => {
    if (scrollRafRef.current !== null) {
      return
    }

    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null
      if (isPlayingRef.current && !programmaticScrollRef.current) {
        userScrolledRef.current = true
      }
      programmaticScrollRef.current = false
      const nextScrollLeft = viewportRef.current?.scrollLeft ?? 0
      setScrollLeft(nextScrollLeft)
      updateWaveformForViewport(nextScrollLeft, true)
    })
  }

  const handleSliderChange = (value: number, fromUser = true) => {
    if (fromUser && isPlayingRef.current) {
      userScrolledRef.current = true
    }
    const clamped = Math.min(maxScroll, Math.max(0, value))
    if (viewportRef.current) {
      programmaticScrollRef.current = true
      viewportRef.current.scrollLeft = clamped
    }
    setScrollLeft(clamped)
    updateWaveformForViewport(clamped, true)
  }

  const handleTimelineClick = (event: MouseEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current
    if (!viewport || pixelsPerSecond <= 0) {
      return
    }

    const rect = viewport.getBoundingClientRect()
    const localX = event.clientX - rect.left + viewport.scrollLeft
    const sourceSeconds = Math.min(durationSeconds, Math.max(0, localX / pixelsPerSecond))
    seekToTimelinePosition(sourceTimeToTimelineTime(keepSegments, sourceSeconds))
  }

  const nudgeScroll = (delta: number) => {
    handleSliderChange(scrollLeft + delta)
  }

  const waveformLeft = scrollLeft
  const showNavigator = maxScroll > 4
  const canPlay = cutDuration > 0 && audioStreamIndices.length > 0

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

      <div className="timeline-stage">
        <div
          ref={viewportRef}
          className="timeline-viewport"
          onScroll={handleScroll}
          onClick={handleTimelineClick}
          tabIndex={0}
          role="region"
          aria-label="Aperçu de la timeline avec lecture audio"
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
              <rect
                x={0}
                y={0}
                width={canvasWidth}
                height={RULER_HEIGHT}
                className="timeline-ruler-background"
              />
              <line
                x1={0}
                y1={RULER_HEIGHT - 0.5}
                x2={canvasWidth}
                y2={RULER_HEIGHT - 0.5}
                className="timeline-ruler-baseline"
              />
              {ticks.map((tick, index) => {
                const x = toX(tick, pixelsPerSecond)
                return (
                  <g key={`ruler-${index}`}>
                    <line
                      x1={x}
                      y1={RULER_HEIGHT - 8}
                      x2={x}
                      y2={RULER_HEIGHT}
                      className="timeline-ruler-tick"
                    />
                    <text
                      x={x}
                      y={12}
                      className="timeline-ruler-label"
                      textAnchor={index === 0 ? 'start' : index === ticks.length - 1 ? 'end' : 'middle'}
                    >
                      {formatTimeLabel(tick)}
                    </text>
                  </g>
                )
              })}

              {cutRegions.map((region, index) => (
                <rect
                  key={`cut-bar-${index}`}
                  x={toX(region.startSeconds, pixelsPerSecond)}
                  y={RULER_HEIGHT}
                  width={Math.max(1, toX(region.endSeconds - region.startSeconds, pixelsPerSecond))}
                  height={SEGMENT_BAR_HEIGHT}
                  className="timeline-cut-marker"
                />
              ))}

              {keepRegions.map((region, index) => (
                <rect
                  key={`keep-bar-${index}`}
                  x={toX(region.startSeconds, pixelsPerSecond)}
                  y={RULER_HEIGHT}
                  width={Math.max(1, toX(region.endSeconds - region.startSeconds, pixelsPerSecond))}
                  height={SEGMENT_BAR_HEIGHT}
                  className="timeline-keep-marker"
                />
              ))}

              <rect
                x={0}
                y={WAVE_LANE_TOP}
                width={canvasWidth}
                height={WAVE_LANE_HEIGHT}
                className="timeline-background"
              />

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
            </svg>

            {viewportWidth > 0 && (
              <canvas
                ref={waveformCanvasRef}
                className="timeline-waveform-canvas"
                style={{
                  top: WAVE_LANE_TOP,
                  left: waveformLeft,
                  width: viewportWidth,
                  height: WAVE_LANE_HEIGHT
                }}
                aria-hidden="true"
              />
            )}

            <div ref={playheadRef} className="timeline-playhead" aria-hidden="true" />
          </div>
        </div>

        <div className="timeline-controls">
          <div className="timeline-transport">
            <button
              type="button"
              className="btn timeline-transport-button timeline-transport-button--icon"
              onClick={() =>
                isPlayingRef.current && !isPlaybackPreparing
                  ? pausePlayback()
                  : void startPlayback(playbackPositionSeconds)
              }
              disabled={!canPlay || isPlaybackPreparing}
              aria-label={
                isPlaybackPreparing ? 'Préparation audio' : isPlaying ? 'Pause' : 'Lecture'
              }
              aria-busy={isPlaybackPreparing}
            >
              {isPlaybackPreparing ? (
                <Loader2 size={18} className="timeline-transport-spinner" aria-hidden />
              ) : isPlaying ? (
                <Pause size={18} aria-hidden />
              ) : (
                <Play size={18} aria-hidden />
              )}
            </button>
            <button
              type="button"
              className="btn timeline-transport-button timeline-transport-button--icon"
              onClick={stopPlayback}
              disabled={!canPlay}
              aria-label="Arrêter"
            >
              <Square size={16} aria-hidden />
            </button>
          </div>

          {showNavigator && (
            <div className="timeline-nav">
              <button
                type="button"
                className="btn timeline-scroll-button"
                onClick={() => nudgeScroll(-viewportWidth * 0.5)}
                aria-label="Défiler vers la gauche"
              >
                ‹
              </button>
              <input
                id="timeline-position"
                type="range"
                className="timeline-nav-slider"
                min={0}
                max={maxScroll}
                step={1}
                value={scrollLeft}
                onChange={(e) => handleSliderChange(Number(e.target.value))}
                aria-label="Position dans la timeline"
              />
              <button
                type="button"
                className="btn timeline-scroll-button"
                onClick={() => nudgeScroll(viewportWidth * 0.5)}
                aria-label="Défiler vers la droite"
              >
                ›
              </button>
            </div>
          )}

          <div className="timeline-playback-meta">
            <span className="timeline-nav-time">
              {formatTimeLabel(viewStartSeconds)} – {formatTimeLabel(viewEndSeconds)}
            </span>
            <span className="timeline-playback-time">
              {formatDuration(playbackPositionSeconds)} / {formatDuration(cutDuration)}
            </span>
          </div>
        </div>
      </div>

      <p className="timeline-hint">Lecture du montage avec le mix des pistes cochées.</p>
      {playbackError && <p className="timeline-playback-error">{playbackError}</p>}
    </div>
  )
}
