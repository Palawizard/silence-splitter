import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AudioWaveform,
  Film,
  FolderOpen,
  Music2,
  Settings,
  SlidersHorizontal
} from 'lucide-react'
import type { KeepSegment } from '@core/models/keep-segment'
import type { MediaInfo } from '@core/models/media-info'
import type { TimelinePreviewData } from '@core/models/timeline-preview'
import {
  DEFAULT_PRESET_ID,
  PRESETS,
  getPresetById,
  type DetectionParams
} from '@core/presets'
import { defaultAnalysisTrackIndices } from '@core/media/default-analysis-tracks'
import { useI18n } from './context/I18nProvider'
import { useSettings } from './context/SettingsProvider'
import { getPresetLabel } from './i18n'
import SettingsModal from './components/SettingsModal'
import ExportPanel, {
  type TimelineExportFormat,
  type TimelineExportNle
} from './components/ExportPanel'
import TimelinePreview from './components/TimelinePreview'
import WelcomeModal from './components/WelcomeModal'
import UpdateBanner from './components/UpdateBanner'
import {
  audioTrackLabel,
  formatDuration,
  formatFrameRate,
  formatResolution
} from './utils/format'
import { outlineIconProps } from './utils/icons'
import './styles/app.css'

type LoadState = 'idle' | 'probing' | 'waveform' | 'detecting' | 'ready' | 'error'
type ExportState = 'idle' | 'exporting' | 'success'

export default function App() {
  const { locale, t } = useI18n()
  const { settings, updateSettings } = useSettings()
  const [showSettings, setShowSettings] = useState(false)
  const [welcomeDismissed, setWelcomeDismissed] = useState(settings.firstRunComplete)
  const [ffmpegOk, setFfmpegOk] = useState(true)
  const [media, setMedia] = useState<MediaInfo | null>(null)
  const [selectedTracks, setSelectedTracks] = useState<number[]>([])
  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID)
  const [params, setParams] = useState<DetectionParams>(getPresetById(DEFAULT_PRESET_ID).params)
  const [keepSegments, setKeepSegments] = useState<KeepSegment[]>([])
  const [preview, setPreview] = useState<TimelinePreviewData | null>(null)
  const [filterBelowDb, setFilterBelowDb] = useState<number | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [exportState, setExportState] = useState<ExportState>('idle')
  const [exportNle, setExportNle] = useState<TimelineExportNle>(settings.exportNle)
  const [resolveExportFormat, setResolveExportFormat] = useState<TimelineExportFormat>(
    settings.resolveExportFormat
  )
  const [premiereExportFormat, setPremiereExportFormat] = useState<TimelineExportFormat>(
    settings.premiereExportFormat
  )
  const [exportedPath, setExportedPath] = useState<string | null>(null)
  const [exportedAudioDirectory, setExportedAudioDirectory] = useState<string | null>(null)

  const paramFields = useMemo(
    () =>
      [
        { key: 'removeSilencesLongerThanSeconds' as const, labelKey: 'detection.paramRemoveSilence' },
        { key: 'ignoreDetectionsShorterThanSeconds' as const, labelKey: 'detection.paramIgnoreShort' },
        { key: 'leftPaddingSeconds' as const, labelKey: 'detection.paramLeftPadding' },
        { key: 'rightPaddingSeconds' as const, labelKey: 'detection.paramRightPadding' }
      ].map((field) => ({
        ...field,
        label: t(field.labelKey),
        step: field.key.includes('Padding') ? 0.01 : field.key === 'removeSilencesLongerThanSeconds' ? 0.05 : 0.05,
        min: field.key.includes('Padding') ? 0 : 0.05
      })),
    [t]
  )

  useEffect(() => {
    setWelcomeDismissed(settings.firstRunComplete)
  }, [settings.firstRunComplete])

  useEffect(() => {
    setExportNle(settings.exportNle)
    setResolveExportFormat(settings.resolveExportFormat)
    setPremiereExportFormat(settings.premiereExportFormat)
  }, [settings.exportNle, settings.resolveExportFormat, settings.premiereExportFormat])

  useEffect(() => {
    window.api.checkFfmpeg().then((status) => {
      setFfmpegOk(status.ffmpeg && status.ffprobe)
    })
  }, [])

  const runDetection = useCallback(
    async (info: MediaInfo, trackIndices: number[], detectionParams: DetectionParams) => {
      if (trackIndices.length === 0) {
        setKeepSegments([])
        setPreview(null)
        setFilterBelowDb(null)
        setLoadState('ready')
        return
      }

      setLoadState('detecting')
      setExportState('idle')
      setExportedPath(null)
      setExportedAudioDirectory(null)
      try {
        const result = await window.api.detectSilences({
          filePath: info.filePath,
          durationSeconds: info.durationSeconds,
          audioStreamIndices: trackIndices,
          params: detectionParams
        })
        setKeepSegments(result.keepSegments)
        setPreview(result.preview)
        setFilterBelowDb(result.thresholdDisplayDb)
        setLoadState('ready')
      } catch (err) {
        setKeepSegments([])
        setPreview(null)
        setFilterBelowDb(null)
        setLoadState('error')
        setErrorMessage(err instanceof Error ? err.message : t('errors.detectSilences'))
      }
    },
    [t]
  )

  const requestWaveformWindow = useCallback(
    async (startSeconds: number, endSeconds: number, bucketCount: number) => {
      if (!media || selectedTracks.length === 0) {
        return null
      }

      try {
        return await window.api.extractWaveformWindow({
          filePath: media.filePath,
          durationSeconds: media.durationSeconds,
          audioStreamIndices: selectedTracks,
          startSeconds,
          endSeconds,
          bucketCount
        })
      } catch {
        return null
      }
    },
    [media, selectedTracks]
  )

  const loadMedia = useCallback(
    async (filePath: string) => {
      setLoadState('probing')
      setErrorMessage(null)
      setKeepSegments([])
      setPreview(null)
      setFilterBelowDb(null)
      setExportState('idle')
      setExportedPath(null)
      setExportedAudioDirectory(null)

      try {
        const info = await window.api.probeMedia(filePath)
        setMedia(info)
        setSelectedTracks(defaultAnalysisTrackIndices(info.audioStreams))
      } catch (err) {
        setMedia(null)
        setSelectedTracks([])
        setLoadState('error')
        setErrorMessage(err instanceof Error ? err.message : t('errors.probeFile'))
      }
    },
    [t]
  )

  useEffect(() => {
    if (!media || selectedTracks.length === 0) {
      return
    }

    void runDetection(media, selectedTracks, params)
  }, [media, selectedTracks, params, runDetection])

  async function handleSelectFile() {
    const path = await window.api.openVideoFile()
    if (path) {
      await loadMedia(path)
    }
  }

  function handleToggleTrack(streamIndex: number) {
    if (!media) {
      return
    }

    const next = selectedTracks.includes(streamIndex)
      ? selectedTracks.filter((i) => i !== streamIndex)
      : [...selectedTracks, streamIndex].sort((a, b) => a - b)

    setSelectedTracks(next)
  }

  function handlePresetChange(nextPresetId: string) {
    setPresetId(nextPresetId)
    setParams(getPresetById(nextPresetId).params)
  }

  function handleParamChange(key: keyof DetectionParams, rawValue: string) {
    const numeric = Number(rawValue)
    if (!Number.isFinite(numeric)) {
      return
    }
    setParams((current) => ({ ...current, [key]: numeric }))
  }

  async function handleExportTimeline() {
    if (!media || keepSegments.length === 0 || loadState !== 'ready') {
      return
    }

    setExportState('exporting')
    setExportedPath(null)
    setExportedAudioDirectory(null)
    setErrorMessage(null)
    try {
      const result = await window.api.exportTimeline({
        media,
        keepSegments,
        nle: exportNle,
        resolveFormat: exportNle === 'resolve' ? resolveExportFormat : undefined,
        premiereFormat: exportNle === 'premiere' ? premiereExportFormat : undefined
      })
      if (result.canceled) {
        setExportState('idle')
        return
      }

      setExportedPath(result.filePath ?? null)
      setExportedAudioDirectory(result.audioDirectoryPath ?? null)
      setExportState('success')
    } catch {
      setExportState('idle')
      setErrorMessage(t('errors.exportTimeline'))
    }
  }

  const isLoading = loadState === 'probing' || loadState === 'detecting'
  const showVfrWarning = media?.video?.isVariableFrameRate === true
  const showWelcome = !settings.firstRunComplete && !welcomeDismissed

  if (showWelcome) {
    return <WelcomeModal onComplete={() => setWelcomeDismissed(true)} />
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          <div className="app-header-text">
            <h1>{t('app.title')}</h1>
            <p className="subtitle">{t('app.subtitle')}</p>
          </div>
        </div>
        <button
          type="button"
          className="btn settings-entry"
          aria-label={t('settings.title')}
          title={t('settings.title')}
          onClick={() => setShowSettings(true)}
        >
          <Settings size={20} {...outlineIconProps} aria-hidden />
        </button>
      </header>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      <UpdateBanner />

      {!ffmpegOk && (
        <div className="banner" role="alert">
          {t('ffmpeg.missing')}
        </div>
      )}

      {errorMessage && (
        <div className="banner" role="alert">
          {errorMessage}
        </div>
      )}

      <section className={`card source-card${media ? ' has-media' : ''}`}>
        <div className="source-card-copy">
          <div className="section-heading">
            <span className="section-icon" aria-hidden>
              <Film size={18} {...outlineIconProps} />
            </span>
            <h2>{t('source.title')}</h2>
          </div>
          {media ? (
            <p className="file-name" title={media.filePath}>{media.filePath}</p>
          ) : (
            <p className="source-description">{t('source.emptyHint')}</p>
          )}
          {isLoading && (
            <p className="status">
              <span className="status-dot" aria-hidden />
              {loadState === 'detecting' ? t('source.detecting') : t('source.analyzing')}
            </p>
          )}
        </div>
        <div className="source-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSelectFile}
            disabled={!ffmpegOk || isLoading}
          >
            <FolderOpen size={17} {...outlineIconProps} aria-hidden />
            {t('source.chooseFile')}
          </button>
        </div>
      </section>

      {media && (
        <>
          <div className="workspace-grid">
          <section className="card info-card">
            <div className="section-heading">
              <span className="section-icon" aria-hidden><Film size={17} {...outlineIconProps} /></span>
              <h2>{t('info.title')}</h2>
            </div>
            <dl className="meta-grid">
              <div>
                <dt>{t('info.duration')}</dt>
                <dd>{formatDuration(media.durationSeconds, locale)}</dd>
              </div>
              <div>
                <dt>{t('info.frameRate')}</dt>
                <dd>{media.video ? formatFrameRate(media.video.frameRate, locale) : '—'}</dd>
              </div>
              <div>
                <dt>{t('info.resolution')}</dt>
                <dd>
                  {media.video
                    ? formatResolution(media.video.width, media.video.height)
                    : '—'}
                </dd>
              </div>
            </dl>
            {showVfrWarning && (
              <div className="banner banner-warning" role="status">
                {t('info.vfrWarning')}
              </div>
            )}
          </section>

          <section className="card">
            <div className="section-heading">
              <span className="section-icon" aria-hidden><Music2 size={17} {...outlineIconProps} /></span>
              <h2>{t('tracks.title')}</h2>
            </div>
            <p className="hint">{t('tracks.hint')}</p>
            {media.audioStreams.length === 0 ? (
              <p className="muted">{t('tracks.none')}</p>
            ) : (
              <ul className="track-list">
                {media.audioStreams.map((stream, ordinal) => (
                  <li key={stream.index}>
                    <label className="track-item">
                      <input
                        type="checkbox"
                        checked={selectedTracks.includes(stream.index)}
                        onChange={() => handleToggleTrack(stream.index)}
                        disabled={isLoading}
                      />
                      <span>
                        {audioTrackLabel(
                          locale,
                          ordinal + 1,
                          stream.codec,
                          stream.channels,
                          stream.language,
                          stream.title,
                          stream.bitRate
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {selectedTracks.length > 0 && (
            <section className="card">
              <div className="section-heading">
                <span className="section-icon" aria-hidden><SlidersHorizontal size={17} {...outlineIconProps} /></span>
                <h2>{t('detection.title')}</h2>
              </div>
              <div className="field">
                <label htmlFor="preset-select">{t('detection.preset')}</label>
                <select
                  id="preset-select"
                  className="select"
                  value={presetId}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  disabled={isLoading}
                >
                  {PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {getPresetLabel(locale, preset.id)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="param-grid">
                {paramFields.map((field) => (
                  <div key={field.key} className="field">
                    <label htmlFor={field.key}>
                      {field.label} {t('detection.secondsSuffix')}
                    </label>
                    <input
                      id={field.key}
                      type="number"
                      className="input"
                      min={field.min}
                      step={field.step}
                      value={params[field.key]}
                      onChange={(e) => handleParamChange(field.key, e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}
          </div>

          {preview && loadState === 'ready' && (
            <>
              <section className="card card-wide">
                <div className="section-heading">
                  <span className="section-icon" aria-hidden><AudioWaveform size={17} {...outlineIconProps} /></span>
                  <h2>{t('preview.title')}</h2>
                </div>
                <TimelinePreview
                  data={preview}
                  durationSeconds={media?.durationSeconds ?? preview.waveform.durationSeconds}
                  filterBelowDb={filterBelowDb}
                  filePath={media.filePath}
                  audioStreamIndices={selectedTracks}
                  keepSegments={keepSegments}
                  onRequestWaveformWindow={requestWaveformWindow}
                />
              </section>

              <ExportPanel
                nle={exportNle}
                resolveFormat={resolveExportFormat}
                premiereFormat={premiereExportFormat}
                state={exportState}
                exportedPath={exportedPath}
                exportedAudioDirectory={exportedAudioDirectory}
                onNleChange={(next) => {
                  setExportNle(next)
                  void updateSettings({ exportNle: next })
                }}
                onResolveFormatChange={(next) => {
                  setResolveExportFormat(next)
                  void updateSettings({ resolveExportFormat: next })
                }}
                onPremiereFormatChange={(next) => {
                  setPremiereExportFormat(next)
                  void updateSettings({ premiereExportFormat: next })
                }}
                onExport={() => void handleExportTimeline()}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}
