import { useCallback, useEffect, useRef, useState } from 'react'
import { cutTimelineDuration } from '@core/playback'
import type { KeepSegment } from '@core/models/keep-segment'
import { formatDuration } from '../utils/format'

type AudioCutPreviewProps = {
  filePath: string
  mediaDurationSeconds: number
  audioStreamIndices: number[]
  keepSegments: KeepSegment[]
}

const CHUNK_DURATION_SECONDS = 20

export default function AudioCutPreview({
  filePath,
  mediaDurationSeconds,
  audioStreamIndices,
  keepSegments
}: AudioCutPreviewProps) {
  const durationSeconds = cutTimelineDuration(keepSegments)
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
  const [positionSeconds, setPositionSeconds] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
      durationSeconds,
      anchorTimelineTimeRef.current +
        Math.max(0, context.currentTime - anchorContextTimeRef.current)
    )
  }, [durationSeconds])

  const finishPlayback = useCallback(() => {
    isPlayingRef.current = false
    setIsPlaying(false)
    positionRef.current = durationSeconds
    setPositionSeconds(durationSeconds)
  }, [durationSeconds])

  const fillQueueRef = useRef<(generation: number) => Promise<void>>(async () => undefined)

  fillQueueRef.current = async (generation: number) => {
    if (fillingGenerationRef.current === generation || generation !== generationRef.current) {
      return
    }

    const context = audioContextRef.current
    if (!context) {
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
          durationSeconds: mediaDurationSeconds,
          audioStreamIndices,
          keepSegments,
          timelineStartSeconds: nextTimelineTimeRef.current,
          chunkDurationSeconds: CHUNK_DURATION_SECONDS
        })
        if (generation !== generationRef.current || !isPlayingRef.current) {
          return
        }
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
        setErrorMessage("Impossible de lire l'aperçu audio.")
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
      const startPosition = requestedPosition >= durationSeconds ? 0 : requestedPosition
      const context = audioContextRef.current ?? new AudioContext()
      audioContextRef.current = context
      await context.resume()

      const generation = generationRef.current
      isPlayingRef.current = true
      setIsPlaying(true)
      setErrorMessage(null)
      positionRef.current = startPosition
      setPositionSeconds(startPosition)
      nextTimelineTimeRef.current = startPosition
      nextScheduleTimeRef.current = context.currentTime + 0.05
      anchorTimelineTimeRef.current = startPosition
      anchorContextTimeRef.current = nextScheduleTimeRef.current
      void fillQueueRef.current(generation)
    },
    [durationSeconds, stopScheduledAudio]
  )

  const pausePlayback = useCallback(() => {
    const currentPosition = readCurrentPosition()
    stopScheduledAudio()
    isPlayingRef.current = false
    setIsPlaying(false)
    positionRef.current = currentPosition
    setPositionSeconds(currentPosition)
  }, [readCurrentPosition, stopScheduledAudio])

  useEffect(() => {
    if (!isPlaying) {
      return
    }

    const updatePosition = () => {
      const currentPosition = readCurrentPosition()
      positionRef.current = currentPosition
      setPositionSeconds(currentPosition)
      animationFrameRef.current = window.requestAnimationFrame(updatePosition)
    }
    animationFrameRef.current = window.requestAnimationFrame(updatePosition)
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [isPlaying, readCurrentPosition])

  useEffect(() => {
    stopScheduledAudio()
    isPlayingRef.current = false
    setIsPlaying(false)
    positionRef.current = 0
    setPositionSeconds(0)
    setErrorMessage(null)
  }, [filePath, audioStreamIndices, keepSegments, stopScheduledAudio])

  useEffect(
    () => () => {
      stopScheduledAudio()
      void audioContextRef.current?.close()
    },
    [stopScheduledAudio]
  )

  const handleSeek = (nextPosition: number) => {
    const clamped = Math.min(durationSeconds, Math.max(0, nextPosition))
    if (isPlayingRef.current) {
      void startPlayback(clamped)
    } else {
      positionRef.current = clamped
      setPositionSeconds(clamped)
    }
  }

  return (
    <div className="audio-preview">
      <div className="audio-preview-controls">
        <button
          type="button"
          className="btn audio-preview-button"
          onClick={() =>
            isPlayingRef.current ? pausePlayback() : void startPlayback(positionSeconds)
          }
          disabled={durationSeconds <= 0 || audioStreamIndices.length === 0}
        >
          {isPlaying ? 'Pause' : 'Lire'}
        </button>
        <input
          type="range"
          className="audio-preview-slider"
          min={0}
          max={Math.max(durationSeconds, 0.001)}
          step={0.01}
          value={Math.min(positionSeconds, durationSeconds)}
          onChange={(event) => handleSeek(Number(event.target.value))}
          aria-label="Position dans le montage audio"
        />
        <span className="audio-preview-time">
          {formatDuration(positionSeconds)} / {formatDuration(durationSeconds)}
        </span>
      </div>
      <p className="audio-preview-hint">Lecture du montage avec le mix des pistes cochées.</p>
      {errorMessage && <p className="audio-preview-error">{errorMessage}</p>}
    </div>
  )
}
