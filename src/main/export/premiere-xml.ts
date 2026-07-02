import type { KeepSegment } from '@core/models/keep-segment'
import type { MediaInfo } from '@core/models/media-info'
import { buildTimelineExportModel } from '@core/export/timeline-model'
import { generatePremiereOtio, generatePremiereXml } from '@core/export/premiere'
import { writeFile } from 'node:fs/promises'
import { prepareAudioSidecars } from './audio-sidecars'
import { ensureOtioExtension, ensureXmlExtension } from './resolve-xml'

type PremiereExportFiles = {
  audioDirectoryPath?: string
}

export type PremiereXmlExportFiles = PremiereExportFiles & {
  xmlPath: string
}

export type PremiereOtioExportFiles = PremiereExportFiles & {
  otioPath: string
}

export async function writePremiereOtio(
  outputPath: string,
  media: MediaInfo,
  keepSegments: KeepSegment[]
): Promise<PremiereOtioExportFiles> {
  const otioPath = ensureOtioExtension(outputPath)
  const preparedAudio = await prepareAudioSidecars(otioPath, media)
  const model = buildTimelineExportModel(media, keepSegments, undefined, preparedAudio.sidecars)
  await writeFile(otioPath, generatePremiereOtio(model), 'utf8')
  return { otioPath, audioDirectoryPath: preparedAudio.directoryPath }
}

export async function writePremiereXml(
  outputPath: string,
  media: MediaInfo,
  keepSegments: KeepSegment[]
): Promise<PremiereXmlExportFiles> {
  const finalPath = ensureXmlExtension(outputPath)
  const preparedAudio = await prepareAudioSidecars(finalPath, media)
  const model = buildTimelineExportModel(
    media,
    keepSegments,
    undefined,
    preparedAudio.sidecars
  )
  const xml = generatePremiereXml(model)
  await writeFile(finalPath, xml, 'utf8')
  return {
    xmlPath: finalPath,
    audioDirectoryPath: preparedAudio.directoryPath
  }
}
