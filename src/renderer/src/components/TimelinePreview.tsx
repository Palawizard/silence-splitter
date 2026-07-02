import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import {
  cutTimelineDuration,
  PLAYBACK_SAMPLE_RATE,
  sourceTimeToTimelineTime,
  timelineTimeToSourceTime
} from '@core/playback'
import type { KeepSegment } from '@core/models/keep-segment'
import type { TimelinePreviewData } from '@core/models/timeline-preview'
import { useI18n } from '../context/I18nProvider'
import { formatDuration } from '../utils/format'
import TimelineControls from './timeline/TimelineControls'
import TimelineTrack from './timeline/TimelineTrack'
import {
  buildTimeTicks,
  computePixelsPerSecond,
  drawWindowWaveform,
  peaksFromDecimatedEnvelope,
  toX,
  WAVE_LANE_HEIGHT
} from './timeline/geometry'

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
const WAVE_AMPLITUDE = 0.92
const PLAYHEAD_LEFT_MARGIN_RATIO = 0.06
const PLAYHEAD_RIGHT_EDGE_RATIO = 0.94
const PLAYBACK_LABEL_INTERVAL_MS = 100

export default function TimelinePreview({
  data,
  durationSeconds,
  filterBelowDb,
  filePath,
  audioStreamIndices,
  keepSegments,
  onRequestWaveformWindow
}: TimelinePreviewProps) {
  const { locale, t, tp } = useI18n()
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
        setPlaybackError(t('errors.playbackPreview'))
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

  const waveformLeft = scrollLeft
  const showNavigator = maxScroll > 4
  const canPlay = cutDuration > 0 && audioStreamIndices.length > 0

  return (
    <div className="timeline-preview">
      <div className="timeline-summary">
        <span>{tp('preview.segmentCount', segmentCount)}</span>
        <span className="timeline-summary-sep">·</span>
        <span>
          {tp('preview.keptDuration', Math.round(keptDurationSeconds), {
            duration: formatDuration(keptDurationSeconds, locale)
          })}
        </span>
        <span className="timeline-summary-sep">·</span>
        <span>
          {tp('preview.cutDuration', Math.round(cutDurationSeconds), {
            duration: formatDuration(cutDurationSeconds, locale)
          })}
        </span>
        {filterBelowDb !== null && filterBelowDb !== undefined && (
          <>
            <span className="timeline-summary-sep">·</span>
            <span>{t('preview.threshold', { db: filterBelowDb.toFixed(0) })}</span>
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
          aria-label={t('preview.ariaRegion')}
        >
          <TimelineTrack
            canvasWidth={canvasWidth}
            pixelsPerSecond={pixelsPerSecond}
            ticks={ticks}
            cutRegions={cutRegions}
            keepRegions={keepRegions}
            viewportWidth={viewportWidth}
            waveformLeft={waveformLeft}
            waveformCanvasRef={waveformCanvasRef}
            playheadRef={playheadRef}
          />
        </div>

        <TimelineControls
          canPlay={canPlay}
          isPlaying={isPlaying}
          isPlaybackPreparing={isPlaybackPreparing}
          showNavigator={showNavigator}
          viewportWidth={viewportWidth}
          maxScroll={maxScroll}
          scrollLeft={scrollLeft}
          viewStartSeconds={viewStartSeconds}
          viewEndSeconds={viewEndSeconds}
          playbackPositionSeconds={playbackPositionSeconds}
          cutDuration={cutDuration}
          onPlayPause={() =>
            isPlayingRef.current && !isPlaybackPreparing
              ? pausePlayback()
              : void startPlayback(playbackPositionSeconds)
          }
          onStop={stopPlayback}
          onScrollChange={handleSliderChange}
        />
      </div>

      {playbackError && <p className="timeline-playback-error">{playbackError}</p>}
    </div>
  )
}
