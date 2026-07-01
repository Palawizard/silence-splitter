import { ipcMain, dialog, BrowserWindow, type OpenDialogOptions } from 'electron'
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
      return extractWaveformEnvelope(
        payload.filePath,
        payload.durationSeconds,
        payload.audioStreamIndices
      )
    }
  )
}
