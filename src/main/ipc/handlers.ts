import type { DetectionParams } from '@core/presets'
import type { WaveformEnvelope } from '@core/models/waveform-envelope'
import { ipcMain, dialog, BrowserWindow, type OpenDialogOptions } from 'electron'
import { runSilenceDetection } from '../analysis/detect-silences'
import { clearPcmCache } from '../analysis/pcm-cache'
import { buildWaveformWindow } from '../analysis/waveform-window'
import { checkFfmpegAvailable } from '../ffmpeg/check'
import { probeMedia } from '../ffmpeg/probe'
import { extractWaveformEnvelope } from '../ffmpeg/waveform'

export function registerIpcHandlers(): void {
  ipcMain.handle('app:check-ffmpeg', () => checkFfmpegAvailable())

  ipcMain.handle('dialog:open-video', async () => {
    const window = BrowserWindow.getFocusedWindow()
    const options: OpenDialogOptions = {
      properties: ['openFile'],
      filters: [{ name: 'Vidéo', extensions: ['mp4'] }]
    }

    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })

  ipcMain.handle('media:probe', async (_event, filePath: string) => {
    return probeMedia(filePath)
  })

  ipcMain.handle(
    'media:waveform',
    async (
      _event,
      payload: { filePath: string; durationSeconds: number; audioStreamIndices: number[] }
    ) => {
      clearPcmCache()
      return extractWaveformEnvelope(
        payload.filePath,
        payload.durationSeconds,
        payload.audioStreamIndices
      )
    }
  )

  ipcMain.handle(
    'media:detect-silences',
    async (
      _event,
      payload: {
        filePath: string
        durationSeconds: number
        audioStreamIndices: number[]
        params: DetectionParams
      }
    ) => {
      return runSilenceDetection(
        payload.filePath,
        payload.durationSeconds,
        payload.audioStreamIndices,
        payload.params
      )
    }
  )

  ipcMain.handle(
    'media:waveform-window',
    async (
      _event,
      payload: {
        filePath: string
        durationSeconds: number
        audioStreamIndices: number[]
        startSeconds: number
        endSeconds: number
        bucketCount: number
      }
    ) => {
      return buildWaveformWindow(
        payload.filePath,
        payload.durationSeconds,
        payload.audioStreamIndices,
        payload.startSeconds,
        payload.endSeconds,
        payload.bucketCount
      )
    }
  )
}
