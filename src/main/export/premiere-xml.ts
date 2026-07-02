import type { KeepSegment } from '@core/models/keep-segment'
import type { MediaInfo } from '@core/models/media-info'
import { buildTimelineExportModel } from '@core/export/timeline-model'
import { generatePremiereXml } from '@core/export/premiere'
import { writeFile } from 'node:fs/promises'
import { prepareAudioSidecars } from './audio-sidecars'
import { ensureXmlExtension } from './resolve-xml'

export type PremiereXmlExportFiles = {
  xmlPath: string
  audioDirectoryPath?: string
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
