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
import { writePremiereOtio, writePremiereXml } from '../export/premiere-xml'
import { registerBootstrapHandlers } from './bootstrap-handlers'
import { registerSettingsHandlers } from './settings-handlers'

export type TimelineExportNle = 'resolve' | 'premiere'
export type ResolveTimelineFormat = 'otio' | 'xml'
export type PremiereTimelineFormat = 'otio' | 'xml'

export function registerIpcHandlers(): void {
  registerBootstrapHandlers()
  registerSettingsHandlers()

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
    'export:timeline',
    async (
      _event,
      payload: {
        media: MediaInfo
        keepSegments: KeepSegment[]
        nle: TimelineExportNle
        resolveFormat?: ResolveTimelineFormat
        premiereFormat?: PremiereTimelineFormat
      }
    ) => {
      const window = BrowserWindow.getFocusedWindow()
      const sourceName = parse(payload.media.filePath).name
      const isResolve = payload.nle === 'resolve'
      const isPremiere = payload.nle === 'premiere'
      const isOtio = isResolve
        ? payload.resolveFormat !== 'xml'
        : payload.premiereFormat !== 'xml'
      const extension = isOtio ? 'otio' : 'xml'
      const nleSlug = isResolve ? 'resolve' : 'premiere'
      const options: SaveDialogOptions = {
        title: isResolve ? 'Exporter pour DaVinci Resolve' : 'Exporter pour Premiere Pro',
        buttonLabel: 'Enregistrer',
        defaultPath: join(
          parse(payload.media.filePath).dir,
          `${sourceName}-${nleSlug}.${extension}`
        ),
        filters: isOtio
          ? [
              {
                name: isResolve ? 'Timeline Resolve OTIO' : 'Timeline Premiere OTIO',
                extensions: ['otio']
              }
            ]
          : isResolve
            ? [{ name: 'Timeline Resolve XML', extensions: ['xml'] }]
            : [{ name: 'Timeline Premiere Pro XML', extensions: ['xml'] }]
      }
      const result = window
        ? await dialog.showSaveDialog(window, options)
        : await dialog.showSaveDialog(options)

      if (result.canceled || !result.filePath) {
        return { canceled: true }
      }

      if (isPremiere) {
        if (isOtio) {
          const files = await writePremiereOtio(result.filePath, payload.media, payload.keepSegments)
          return {
            canceled: false,
            filePath: files.otioPath,
            audioDirectoryPath: files.audioDirectoryPath
          }
        }

        const files = await writePremiereXml(result.filePath, payload.media, payload.keepSegments)
        return {
          canceled: false,
          filePath: files.xmlPath,
          audioDirectoryPath: files.audioDirectoryPath
        }
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
