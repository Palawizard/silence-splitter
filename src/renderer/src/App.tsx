import { useCallback, useEffect, useState } from 'react'
import type { MediaInfo } from '@core/models/media-info'
import type { WaveformEnvelope } from '@core/models/waveform-envelope'
import {
  audioTrackLabel,
  formatDuration,
  formatFrameRate,
  formatResolution
} from './utils/format'
import './styles/app.css'

type LoadState = 'idle' | 'probing' | 'waveform' | 'ready' | 'error'

export default function App() {
  const [ffmpegOk, setFfmpegOk] = useState(true)
  const [media, setMedia] = useState<MediaInfo | null>(null)
  const [selectedTracks, setSelectedTracks] = useState<number[]>([])
  const [waveform, setWaveform] = useState<WaveformEnvelope | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    window.api.checkFfmpeg().then((status) => {
      setFfmpegOk(status.ffmpeg && status.ffprobe)
    })
  }, [])

  const extractWaveform = useCallback(
    async (info: MediaInfo, trackIndices: number[]) => {
      if (trackIndices.length === 0) {
        setWaveform(null)
        setLoadState('ready')
        return
      }

      setLoadState('waveform')
      try {
        const envelope = await window.api.extractWaveform({
          filePath: info.filePath,
          durationSeconds: info.durationSeconds,
          audioStreamIndices: trackIndices
        })
        setWaveform(envelope)
        setLoadState('ready')
      } catch (err) {
        setWaveform(null)
        setLoadState('error')
        setErrorMessage(
          err instanceof Error ? err.message : "Impossible d'extraire la forme d'onde."
        )
      }
    },
    []
  )

  const loadMedia = useCallback(
    async (filePath: string) => {
      setLoadState('probing')
      setErrorMessage(null)
      setWaveform(null)

      try {
        const info = await window.api.probeMedia(filePath)
        setMedia(info)
        const allTracks = info.audioStreams.map((s) => s.index)
        setSelectedTracks(allTracks)
        await extractWaveform(info, allTracks)
      } catch (err) {
        setMedia(null)
        setSelectedTracks([])
        setLoadState('error')
        setErrorMessage(
          err instanceof Error ? err.message : "Impossible d'analyser le fichier."
        )
      }
    },
    [extractWaveform]
  )

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
    void extractWaveform(media, next)
  }

  const isLoading = loadState === 'probing' || loadState === 'waveform'
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
        {isLoading && <p className="status">Analyse en cours…</p>}
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
                          stream.title
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {waveform && loadState === 'ready' && (
            <p className="muted ready-hint">Forme d&apos;onde prête pour l&apos;aperçu timeline.</p>
          )}
        </>
      )}
    </div>
  )
}
