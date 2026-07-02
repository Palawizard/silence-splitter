import type { AppLocale } from '@core/settings'
import { translate } from '../i18n'

const EM_DASH = '—'

export function formatDuration(seconds: number, locale: AppLocale): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return translate(locale, 'format.durationSeconds', { value: 0 })
  }

  const totalSeconds = Math.round(seconds)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60

  if (hours > 0) {
    return translate(locale, 'format.durationHours', { hours, minutes, seconds: secs })
  }

  if (minutes > 0) {
    return translate(locale, 'format.durationMinutes', { minutes, seconds: secs })
  }

  return translate(locale, 'format.durationSeconds', { value: secs })
}

export function formatFrameRate(fps: number, locale: AppLocale): string {
  if (!Number.isFinite(fps) || fps <= 0) {
    return EM_DASH
  }

  return translate(locale, 'format.frameRate', { fps: fps.toFixed(2) })
}

export function formatResolution(width: number, height: number): string {
  if (width <= 0 || height <= 0) {
    return EM_DASH
  }

  return `${width} × ${height}`
}

export function audioTrackLabel(
  locale: AppLocale,
  ordinal: number,
  codec: string,
  channels: number,
  language?: string,
  title?: string,
  bitRate?: number
): string {
  const channelLabel = translate(locale, 'format.channels', { count: channels })
  const extraParts: string[] = []

  if (bitRate !== undefined && bitRate > 0) {
    extraParts.push(`${Math.round(bitRate / 1000)} kbps`)
  }
  if (title) {
    extraParts.push(title)
  } else if (language) {
    extraParts.push(language.toUpperCase())
  }

  return translate(locale, 'tracks.label', {
    ordinal,
    codec,
    channels: channelLabel,
    extra: extraParts.length > 0 ? extraParts.join(' · ') : EM_DASH
  })
}
