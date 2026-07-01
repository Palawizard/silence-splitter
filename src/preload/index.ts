import { contextBridge, ipcRenderer } from 'electron'
import type { MediaInfo } from '@core/models/media-info'
import type { WaveformEnvelope } from '@core/models/waveform-envelope'

export type FfmpegStatus = {
  ffmpeg: boolean
  ffprobe: boolean
}

export type WaveformRequest = {
  filePath: string
  durationSeconds: number
  audioStreamIndices: number[]
}

const api = {
  checkFfmpeg: (): Promise<FfmpegStatus> => ipcRenderer.invoke('app:check-ffmpeg'),
  openVideoFile: (): Promise<string | null> => ipcRenderer.invoke('dialog:open-video'),
  probeMedia: (filePath: string): Promise<MediaInfo> => ipcRenderer.invoke('media:probe', filePath),
  extractWaveform: (request: WaveformRequest): Promise<WaveformEnvelope> =>
    ipcRenderer.invoke('media:waveform', request)
}

export type AppApi = typeof api

contextBridge.exposeInMainWorld('api', api)
