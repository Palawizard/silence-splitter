import type { KeepSegment } from '@core/models/keep-segment'
import type { MediaInfo } from '@core/models/media-info'
import { buildTimelineExportModel } from '@core/export/timeline-model'
import { generateResolveOtio, generateResolveXml } from '@core/export/resolve'
import { writeFile } from 'node:fs/promises'
import { prepareAudioSidecars } from './audio-sidecars'

type ResolveExportFiles = {
  audioDirectoryPath?: string
}

export type ResolveXmlExportFiles = ResolveExportFiles & { xmlPath: string }
export type ResolveOtioExportFiles = ResolveExportFiles & { otioPath: string }

export function ensureXmlExtension(filePath: string): string {
  return filePath.toLowerCase().endsWith('.xml') ? filePath : `${filePath}.xml`
}

export function ensureOtioExtension(filePath: string): string {
  return filePath.toLowerCase().endsWith('.otio') ? filePath : `${filePath}.otio`
}

export async function writeResolveOtio(
  outputPath: string,
  media: MediaInfo,
  keepSegments: KeepSegment[]
): Promise<ResolveOtioExportFiles> {
  const otioPath = ensureOtioExtension(outputPath)
  const preparedAudio = await prepareAudioSidecars(otioPath, media)
  const model = buildTimelineExportModel(media, keepSegments, undefined, preparedAudio.sidecars)
  await writeFile(otioPath, generateResolveOtio(model), 'utf8')
  return { otioPath, audioDirectoryPath: preparedAudio.directoryPath }
}

export async function writeResolveXml(
  outputPath: string,
  media: MediaInfo,
  keepSegments: KeepSegment[]
): Promise<ResolveXmlExportFiles> {
  const finalPath = ensureXmlExtension(outputPath)
  const preparedAudio = await prepareAudioSidecars(finalPath, media)
  const model = buildTimelineExportModel(
    media,
    keepSegments,
    undefined,
    preparedAudio.sidecars
  )
  const xml = generateResolveXml(model)
  await writeFile(finalPath, xml, 'utf8')
  return {
    xmlPath: finalPath,
    audioDirectoryPath: preparedAudio.directoryPath
  }
}
