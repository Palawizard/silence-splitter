import type { DetectionParams } from '@core/presets'
import type { KeepSegment } from '@core/models/keep-segment'
import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron'
import { runSilenceDetection } from '../analysis/detect-silences'
import { buildPlaybackChunk } from '../analysis/playback-chunk'
import { clearPcmCache } from '../analysis/pcm-cache'
import { buildWaveformWindow } from '../analysis/waveform-window'
import { checkFfmpegAvailable } from '../ffmpeg/check'
import { probeMedia } from '../ffmpeg/probe'
import { extractWaveformEnvelope } from '../ffmpeg/waveform'
import { dialogMessage } from '../i18n/dialogs'

export function registerMediaHandlers(): void {
  ipcMain.handle('app:check-ffmpeg', () => checkFfmpegAvailable())

  ipcMain.handle('dialog:open-video', async () => {
    const window = BrowserWindow.getFocusedWindow()
    const options: OpenDialogOptions = {
      properties: ['openFile'],
      filters: [{ name: dialogMessage('openVideoFilter'), extensions: ['mp4'] }]
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]
  })

  ipcMain.handle('media:probe', async (_event, filePath: string) => probeMedia(filePath))

  ipcMain.handle('media:waveform', async (_event, payload: {
    filePath: string
    durationSeconds: number
    audioStreamIndices: number[]
  }) => {
    clearPcmCache()
    return extractWaveformEnvelope(payload.filePath, payload.durationSeconds, payload.audioStreamIndices)
  })

  ipcMain.handle('media:detect-silences', async (_event, payload: {
    filePath: string
    durationSeconds: number
    audioStreamIndices: number[]
    params: DetectionParams
  }) => runSilenceDetection(
    payload.filePath,
    payload.durationSeconds,
    payload.audioStreamIndices,
    payload.params
  ))

  ipcMain.handle('media:playback-chunk', async (_event, payload: {
    filePath: string
    durationSeconds: number
    audioStreamIndices: number[]
    keepSegments: KeepSegment[]
    timelineStartSeconds: number
    chunkDurationSeconds: number
  }) => buildPlaybackChunk(
    payload.filePath,
    payload.durationSeconds,
    payload.audioStreamIndices,
    payload.keepSegments,
    payload.timelineStartSeconds,
    Math.min(60, Math.max(1, payload.chunkDurationSeconds))
  ))

  ipcMain.handle('media:waveform-window', async (_event, payload: {
    filePath: string
    durationSeconds: number
    audioStreamIndices: number[]
    startSeconds: number
    endSeconds: number
    bucketCount: number
  }) => buildWaveformWindow(
    payload.filePath,
    payload.durationSeconds,
    payload.audioStreamIndices,
    payload.startSeconds,
    payload.endSeconds,
    payload.bucketCount
  ))
}
