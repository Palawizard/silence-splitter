import { contextBridge, ipcRenderer } from 'electron'
import type { KeepSegment } from '@core/models/keep-segment'
import type { MediaInfo } from '@core/models/media-info'
import type { TimelinePreviewData } from '@core/models/timeline-preview'
import type { WaveformEnvelope } from '@core/models/waveform-envelope'
import type { DetectionParams } from '@core/presets'
import { DEFAULT_APP_SETTINGS, type AppSettings, type ThemeMode } from '@core/settings'

export type FfmpegStatus = {
  ffmpeg: boolean
  ffprobe: boolean
}

export type WaveformRequest = {
  filePath: string
  durationSeconds: number
  audioStreamIndices: number[]
}

export type WaveformWindowRequest = WaveformRequest & {
  startSeconds: number
  endSeconds: number
  bucketCount: number
}

export type SilenceDetectionRequest = {
  filePath: string
  durationSeconds: number
  audioStreamIndices: number[]
  params: DetectionParams
}

export type SilenceDetectionResponse = {
  keepSegments: KeepSegment[]
  preview: TimelinePreviewData
  threshold: number
  thresholdDb: number
  thresholdDisplayDb: number
}

export type PlaybackChunkRequest = WaveformRequest & {
  keepSegments: KeepSegment[]
  timelineStartSeconds: number
  chunkDurationSeconds: number
}

export type PlaybackChunkResponse = {
  samples: ArrayBuffer
  sampleRate: number
  timelineStartSeconds: number
  durationSeconds: number
  ended: boolean
}

export type TimelineExportNle = 'resolve' | 'premiere'
export type ResolveTimelineFormat = 'otio' | 'xml'
export type PremiereTimelineFormat = 'otio' | 'xml'

export type TimelineExportRequest = {
  media: MediaInfo
  keepSegments: KeepSegment[]
  nle: TimelineExportNle
  resolveFormat?: ResolveTimelineFormat
  premiereFormat?: PremiereTimelineFormat
}

export type TimelineExportResponse = {
  canceled: boolean
  filePath?: string
  audioDirectoryPath?: string
}

export type EffectiveTheme = 'light' | 'dark'

export type ThemeState = {
  effectiveTheme: EffectiveTheme
  themeMode: ThemeMode
}

export type AppBootstrap = {
  settings: AppSettings
  theme: ThemeState
}

function systemThemeFallback(): ThemeState {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return {
    effectiveTheme: prefersDark ? 'dark' : 'light',
    themeMode: 'system'
  }
}

let bootstrapCache: AppBootstrap | null = null

function loadBootstrap(): AppBootstrap {
  if (bootstrapCache) {
    return bootstrapCache
  }

  try {
    const payload = ipcRenderer.sendSync('app:bootstrap-sync') as AppBootstrap | undefined
    if (
      payload?.settings &&
      payload.theme &&
      (payload.theme.effectiveTheme === 'light' || payload.theme.effectiveTheme === 'dark')
    ) {
      bootstrapCache = payload
      return payload
    }
  } catch {
    // Sync handler may be unavailable during dev hot reload.
  }

  bootstrapCache = {
    settings: { ...DEFAULT_APP_SETTINGS },
    theme: systemThemeFallback()
  }
  return bootstrapCache
}

function applyDocumentTheme(effectiveTheme: EffectiveTheme): void {
  const root = document.documentElement
  if (!root) {
    return
  }

  root.dataset.theme = effectiveTheme
  root.style.colorScheme = effectiveTheme
}

const api = {
  getBootstrap: (): AppBootstrap => loadBootstrap(),
  checkFfmpeg: (): Promise<FfmpegStatus> => ipcRenderer.invoke('app:check-ffmpeg'),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:set', patch),
  onSettingsChanged: (callback: (settings: AppSettings) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, settings: AppSettings) => {
      callback(settings)
    }
    ipcRenderer.on('settings:changed', listener)
    return () => {
      ipcRenderer.removeListener('settings:changed', listener)
    }
  },
  getTheme: (): Promise<ThemeState> => ipcRenderer.invoke('theme:get'),
  onThemeChanged: (callback: (state: ThemeState) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: ThemeState) => {
      callback(state)
    }
    ipcRenderer.on('theme:changed', listener)
    return () => {
      ipcRenderer.removeListener('theme:changed', listener)
    }
  },
  openVideoFile: (): Promise<string | null> => ipcRenderer.invoke('dialog:open-video'),
  probeMedia: (filePath: string): Promise<MediaInfo> => ipcRenderer.invoke('media:probe', filePath),
  extractWaveform: (request: WaveformRequest): Promise<WaveformEnvelope> =>
    ipcRenderer.invoke('media:waveform', request),
  extractWaveformWindow: (request: WaveformWindowRequest): Promise<WaveformEnvelope> =>
    ipcRenderer.invoke('media:waveform-window', request),
  detectSilences: (request: SilenceDetectionRequest): Promise<SilenceDetectionResponse> =>
    ipcRenderer.invoke('media:detect-silences', request),
  getPlaybackChunk: (request: PlaybackChunkRequest): Promise<PlaybackChunkResponse> =>
    ipcRenderer.invoke('media:playback-chunk', request),
  exportTimeline: (request: TimelineExportRequest): Promise<TimelineExportResponse> =>
    ipcRenderer.invoke('export:timeline', request)
}

export type AppApi = typeof api

contextBridge.exposeInMainWorld('api', api)

ipcRenderer.on('theme:changed', (_event, state: ThemeState) => {
  applyDocumentTheme(state.effectiveTheme)
})
