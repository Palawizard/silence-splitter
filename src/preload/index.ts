import { contextBridge, ipcRenderer } from 'electron'
import type { KeepSegment } from '@core/models/keep-segment'
import type { MediaInfo } from '@core/models/media-info'
import type { TimelinePreviewData } from '@core/models/timeline-preview'
import type { WaveformEnvelope } from '@core/models/waveform-envelope'
import type { DetectionParams } from '@core/presets'
import type { AppSettings } from '@core/settings'

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

const api = {
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
