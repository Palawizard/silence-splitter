import { contextBridge, ipcRenderer } from 'electron'
import type { KeepSegment } from '@core/models/keep-segment'
import type { MediaInfo } from '@core/models/media-info'
import type { TimelinePreviewData } from '@core/models/timeline-preview'
import type { WaveformEnvelope } from '@core/models/waveform-envelope'
import type { DetectionParams } from '@core/presets'

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

export type ResolveExportRequest = {
  media: MediaInfo
  keepSegments: KeepSegment[]
  format: 'otio' | 'xml'
}

export type ResolveExportResponse = {
  canceled: boolean
  filePath?: string
  audioDirectoryPath?: string
}

const api = {
  checkFfmpeg: (): Promise<FfmpegStatus> => ipcRenderer.invoke('app:check-ffmpeg'),
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
  exportResolveXml: (request: ResolveExportRequest): Promise<ResolveExportResponse> =>
    ipcRenderer.invoke('export:resolve-xml', request)
}

export type AppApi = typeof api

contextBridge.exposeInMainWorld('api', api)
