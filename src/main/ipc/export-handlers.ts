import type { KeepSegment } from '@core/models/keep-segment'
import type { MediaInfo } from '@core/models/media-info'
import { BrowserWindow, dialog, ipcMain, type SaveDialogOptions } from 'electron'
import { join, parse } from 'node:path'
import { writePremiereOtio, writePremiereXml } from '../export/premiere-xml'
import { writeResolveOtio, writeResolveXml } from '../export/resolve-xml'
import { dialogMessage } from '../i18n/dialogs'

export type TimelineExportNle = 'resolve' | 'premiere'
export type ResolveTimelineFormat = 'otio' | 'xml'
export type PremiereTimelineFormat = 'otio' | 'xml'

type ExportTimelinePayload = {
  media: MediaInfo
  keepSegments: KeepSegment[]
  nle: TimelineExportNle
  resolveFormat?: ResolveTimelineFormat
  premiereFormat?: PremiereTimelineFormat
}

export function registerExportHandlers(): void {
  ipcMain.handle('export:timeline', async (_event, payload: ExportTimelinePayload) => {
    const window = BrowserWindow.getFocusedWindow()
    const sourcePath = parse(payload.media.filePath)
    const isResolve = payload.nle === 'resolve'
    const isPremiere = payload.nle === 'premiere'
    const isOtio = isResolve ? payload.resolveFormat !== 'xml' : payload.premiereFormat !== 'xml'
    const extension = isOtio ? 'otio' : 'xml'
    const options: SaveDialogOptions = {
      title: dialogMessage(isResolve ? 'exportResolveTitle' : 'exportPremiereTitle'),
      buttonLabel: dialogMessage('exportSave'),
      defaultPath: join(sourcePath.dir, `${sourcePath.name}-${isResolve ? 'resolve' : 'premiere'}.${extension}`),
      filters: isOtio
        ? [{
            name: dialogMessage(isResolve ? 'filterResolveOtio' : 'filterPremiereOtio'),
            extensions: ['otio']
          }]
        : [{
            name: dialogMessage(isResolve ? 'filterResolveXml' : 'filterPremiereXml'),
            extensions: ['xml']
          }]
    }
    const result = window
      ? await dialog.showSaveDialog(window, options)
      : await dialog.showSaveDialog(options)

    if (result.canceled || !result.filePath) return { canceled: true }

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
  })
}
