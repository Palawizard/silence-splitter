import type { DetectionParams } from '@core/presets'
import type { KeepSegment } from '@core/models/keep-segment'
import type { MediaInfo } from '@core/models/media-info'
import type { WaveformEnvelope } from '@core/models/waveform-envelope'
import { ipcMain, dialog, BrowserWindow, type OpenDialogOptions, type SaveDialogOptions } from 'electron'
import { join, parse } from 'node:path'
import { runSilenceDetection } from '../analysis/detect-silences'
import { clearPcmCache } from '../analysis/pcm-cache'
import { buildWaveformWindow } from '../analysis/waveform-window'
import { buildPlaybackChunk } from '../analysis/playback-chunk'
import { checkFfmpegAvailable } from '../ffmpeg/check'
import { probeMedia } from '../ffmpeg/probe'
import { extractWaveformEnvelope } from '../ffmpeg/waveform'
import { writeResolveOtio, writeResolveXml } from '../export/resolve-xml'

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
    'media:playback-chunk',
    async (
      _event,
      payload: {
        filePath: string
        durationSeconds: number
        audioStreamIndices: number[]
        keepSegments: KeepSegment[]
        timelineStartSeconds: number
        chunkDurationSeconds: number
      }
    ) => {
      const chunkDuration = Math.min(60, Math.max(1, payload.chunkDurationSeconds))
      return buildPlaybackChunk(
        payload.filePath,
        payload.durationSeconds,
        payload.audioStreamIndices,
        payload.keepSegments,
        payload.timelineStartSeconds,
        chunkDuration
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

  ipcMain.handle(
    'export:resolve-xml',
    async (
      _event,
      payload: { media: MediaInfo; keepSegments: KeepSegment[]; format: 'otio' | 'xml' }
    ) => {
      const window = BrowserWindow.getFocusedWindow()
      const sourceName = parse(payload.media.filePath).name
      const isOtio = payload.format === 'otio'
      const options: SaveDialogOptions = {
        title: 'Exporter pour DaVinci Resolve',
        buttonLabel: 'Enregistrer',
        defaultPath: join(
          parse(payload.media.filePath).dir,
          `${sourceName}-resolve.${isOtio ? 'otio' : 'xml'}`
        ),
        filters: [
          isOtio
            ? { name: 'Timeline Resolve OTIO', extensions: ['otio'] }
            : { name: 'Timeline Resolve XML', extensions: ['xml'] }
        ]
      }
      const result = window
        ? await dialog.showSaveDialog(window, options)
        : await dialog.showSaveDialog(options)

      if (result.canceled || !result.filePath) {
        return { canceled: true }
      }

      if (isOtio) {
        const files = await writeResolveOtio(result.filePath, payload.media, payload.keepSegments)
        return {
          canceled: false,
          filePath: files.otioPath,
          audioDirectoryPath: files.audioDirectoryPath
        }
      }

      const files = await writeResolveXml(result.filePath, payload.media, payload.keepSegments)
      return {
        canceled: false,
        filePath: files.xmlPath,
        audioDirectoryPath: files.audioDirectoryPath
      }
    }
  )
}
