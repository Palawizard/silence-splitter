/** Convert source seconds to frame index at the given fps (0-based). */
export function secondsToFrame(seconds: number, fps: number): number {
  if (!Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(fps) || fps <= 0) {
    return 0
  }
  return Math.round(seconds * fps)
}

/** Convert frame index to source seconds at the given fps. */
export function frameToSeconds(frame: number, fps: number): number {
  if (!Number.isFinite(frame) || frame < 0 || !Number.isFinite(fps) || fps <= 0) {
    return 0
  }
  return frame / fps
}

/** Format source seconds as HH:MM:SS:FF timecode at the given fps. */
export function secondsToTimecode(seconds: number, fps: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '00:00:00:00'
  }

  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 25
  const totalFrames = secondsToFrame(seconds, safeFps)
  const frames = totalFrames % Math.round(safeFps)
  const totalSeconds = Math.floor(totalFrames / safeFps)
  const secs = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const mins = totalMinutes % 60
  const hours = Math.floor(totalMinutes / 60)

  const pad = (n: number, width = 2) => String(n).padStart(width, '0')
  return `${pad(hours)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`
}

/** Clamp a value to [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Clamp a time range to media duration. */
export function clampTimeRange(
  startSeconds: number,
  endSeconds: number,
  durationSeconds: number
): { startSeconds: number; endSeconds: number } {
  const start = clamp(startSeconds, 0, durationSeconds)
  const end = clamp(endSeconds, 0, durationSeconds)
  return start <= end ? { startSeconds: start, endSeconds: end } : { startSeconds: end, endSeconds: start }
}
