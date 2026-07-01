export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0 s'
  }

  const totalSeconds = Math.round(seconds)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60

  if (hours > 0) {
    return `${hours} h ${minutes} min ${secs} s`
  }

  if (minutes > 0) {
    return `${minutes} min ${secs} s`
  }

  return `${secs} s`
}

export function formatFrameRate(fps: number): string {
  if (!Number.isFinite(fps) || fps <= 0) {
    return '—'
  }

  return `${fps.toFixed(2)} ips`
}

export function formatResolution(width: number, height: number): string {
  if (width <= 0 || height <= 0) {
    return '—'
  }

  return `${width} × ${height}`
}

export function audioTrackLabel(
  ordinal: number,
  codec: string,
  channels: number,
  language?: string,
  title?: string,
  bitRate?: number
): string {
  const parts = [`Piste ${ordinal}`, codec, `${channels} can.`]
  if (bitRate !== undefined && bitRate > 0) {
    parts.push(`${Math.round(bitRate / 1000)} kbps`)
  }
  if (title) {
    parts.push(title)
  } else if (language) {
    parts.push(language.toUpperCase())
  }
  return parts.join(' · ')
}
