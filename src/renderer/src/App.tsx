import { useCallback, useEffect, useState } from 'react'
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
import TimelinePreview from './components/TimelinePreview'
import {
  audioTrackLabel,
  formatDuration,
  formatFrameRate,
  formatResolution
} from './utils/format'
import './styles/app.css'

type LoadState = 'idle' | 'probing' | 'waveform' | 'detecting' | 'ready' | 'error'

const PARAM_FIELDS: {
  key: keyof DetectionParams
  label: string
  step: number
  min: number
}[] = [
  { key: 'removeSilencesLongerThanSeconds', label: 'Couper les silences plus longs que', step: 0.05, min: 0.05 },
  { key: 'ignoreDetectionsShorterThanSeconds', label: 'Ignorer les détections plus courtes que', step: 0.05, min: 0.05 },
  { key: 'leftPaddingSeconds', label: 'Marge avant la parole', step: 0.01, min: 0 },
  { key: 'rightPaddingSeconds', label: 'Marge après la parole', step: 0.01, min: 0 }
]

export default function App() {
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
        setErrorMessage(
          err instanceof Error ? err.message : 'Impossible de détecter les silences.'
        )
      }
    },
    []
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

      try {
        const info = await window.api.probeMedia(filePath)
        setMedia(info)
        setSelectedTracks(defaultAnalysisTrackIndices(info.audioStreams))
      } catch (err) {
        setMedia(null)
        setSelectedTracks([])
        setLoadState('error')
        setErrorMessage(
          err instanceof Error ? err.message : "Impossible d'analyser le fichier."
        )
      }
    },
    []
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

  const isLoading = loadState === 'probing' || loadState === 'detecting'
  const showVfrWarning = media?.video?.isVariableFrameRate === true

  return (
    <div className="app">
      <h1>Silence Splitter</h1>
      <p className="subtitle">Détecte les silences et exporte une timeline pour le montage.</p>

      {!ffmpegOk && (
        <div className="banner" role="alert">
          ffmpeg et ffprobe sont requis. Installez-les et relancez l&apos;application.
        </div>
      )}

      {errorMessage && (
        <div className="banner" role="alert">
          {errorMessage}
        </div>
      )}

      <section className="card">
        <h2>Vidéo source</h2>
        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSelectFile}
            disabled={!ffmpegOk || isLoading}
          >
            Choisir un fichier MP4
          </button>
        </div>
        {media && <p className="file-name">{media.filePath}</p>}
        {isLoading && (
          <p className="status">
            {loadState === 'detecting' ? 'Détection des silences…' : 'Analyse en cours…'}
          </p>
        )}
      </section>

      {media && (
        <>
          <section className="card">
            <h2>Informations</h2>
            <dl className="meta-grid">
              <div>
                <dt>Durée</dt>
                <dd>{formatDuration(media.durationSeconds)}</dd>
              </div>
              <div>
                <dt>Images par seconde</dt>
                <dd>{media.video ? formatFrameRate(media.video.frameRate) : '—'}</dd>
              </div>
              <div>
                <dt>Résolution</dt>
                <dd>
                  {media.video
                    ? formatResolution(media.video.width, media.video.height)
                    : '—'}
                </dd>
              </div>
            </dl>
            {showVfrWarning && (
              <div className="banner banner-warning" role="status">
                Images par seconde variables détectées. L&apos;export XML pourra nécessiter une
                vérification dans votre logiciel de montage.
              </div>
            )}
          </section>

          <section className="card">
            <h2>Pistes audio pour l&apos;analyse</h2>
            <p className="hint">
              Les pistes cochées sont mélangées pour la détection des silences. La vidéo source
              reste inchangée à l&apos;export.
            </p>
            {media.audioStreams.length === 0 ? (
              <p className="muted">Aucune piste audio trouvée.</p>
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
              <h2>Détection des silences</h2>
              <div className="field">
                <label htmlFor="preset-select">Préréglage</label>
                <select
                  id="preset-select"
                  className="select"
                  value={presetId}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  disabled={isLoading}
                >
                  {PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="param-grid">
                {PARAM_FIELDS.map((field) => (
                  <div key={field.key} className="field">
                    <label htmlFor={field.key}>{field.label} (s)</label>
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

          {preview && loadState === 'ready' && (
            <section className="card card-wide">
              <h2>Aperçu timeline</h2>
              <p className="hint">
                Zones vertes : passages conservés. Zones roses : silences coupés. Même découpage
                que l&apos;export XML ({keepSegments.length} segment{keepSegments.length !== 1 ? 's' : ''}).
              </p>
              <TimelinePreview
                data={preview}
                durationSeconds={media?.durationSeconds ?? preview.waveform.durationSeconds}
                filterBelowDb={filterBelowDb}
                onRequestWaveformWindow={requestWaveformWindow}
              />
            </section>
          )}
        </>
      )}
    </div>
  )
}
