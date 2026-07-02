import { ChevronLeft, ChevronRight, Loader2, Pause, Play, Square } from 'lucide-react'
import { useI18n } from '../../context/I18nProvider'
import { formatDuration } from '../../utils/format'
import { filledIconProps } from '../../utils/icons'
import { formatTimeLabel } from './geometry'

type TimelineControlsProps = {
  canPlay: boolean
  isPlaying: boolean
  isPlaybackPreparing: boolean
  showNavigator: boolean
  viewportWidth: number
  maxScroll: number
  scrollLeft: number
  viewStartSeconds: number
  viewEndSeconds: number
  playbackPositionSeconds: number
  cutDuration: number
  onPlayPause: () => void
  onStop: () => void
  onScrollChange: (value: number) => void
}

export default function TimelineControls(props: TimelineControlsProps) {
  const { locale, t } = useI18n()
  const {
    canPlay, isPlaying, isPlaybackPreparing, showNavigator, viewportWidth, maxScroll,
    scrollLeft, viewStartSeconds, viewEndSeconds, playbackPositionSeconds, cutDuration,
    onPlayPause, onStop, onScrollChange
  } = props

  return (
    <div className="timeline-controls">
      <div className="timeline-transport">
        <button
          type="button"
          className="btn timeline-transport-button timeline-transport-button--icon"
          onClick={onPlayPause}
          disabled={!canPlay || isPlaybackPreparing}
          aria-label={isPlaybackPreparing ? t('preview.transportPrepare') : isPlaying ? t('preview.transportPause') : t('preview.transportPlay')}
          aria-busy={isPlaybackPreparing}
        >
          {isPlaybackPreparing ? <Loader2 size={18} className="timeline-transport-spinner" aria-hidden />
            : isPlaying ? <Pause size={18} {...filledIconProps} aria-hidden />
              : <Play size={18} {...filledIconProps} aria-hidden />}
        </button>
        <button
          type="button"
          className="btn timeline-transport-button timeline-transport-button--icon"
          onClick={onStop}
          disabled={!canPlay}
          aria-label={t('preview.transportStop')}
        >
          <Square size={14} {...filledIconProps} aria-hidden />
        </button>
      </div>

      {showNavigator && (
        <div className="timeline-nav">
          <button type="button" className="btn timeline-scroll-button timeline-scroll-button--icon" onClick={() => onScrollChange(scrollLeft - viewportWidth * 0.5)} aria-label={t('preview.scrollLeft')}>
            <ChevronLeft size={18} {...filledIconProps} aria-hidden />
          </button>
          <input id="timeline-position" type="range" className="timeline-nav-slider" min={0} max={maxScroll} step={1} value={scrollLeft} onChange={(event) => onScrollChange(Number(event.target.value))} aria-label={t('preview.positionSlider')} />
          <button type="button" className="btn timeline-scroll-button timeline-scroll-button--icon" onClick={() => onScrollChange(scrollLeft + viewportWidth * 0.5)} aria-label={t('preview.scrollRight')}>
            <ChevronRight size={18} {...filledIconProps} aria-hidden />
          </button>
        </div>
      )}

      <div className="timeline-playback-meta">
        <span className="timeline-nav-time">{formatTimeLabel(viewStartSeconds)} – {formatTimeLabel(viewEndSeconds)}</span>
        <span className="timeline-playback-time">{formatDuration(playbackPositionSeconds, locale)} / {formatDuration(cutDuration, locale)}</span>
      </div>
    </div>
  )
}
