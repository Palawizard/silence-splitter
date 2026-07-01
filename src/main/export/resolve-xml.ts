import type { KeepSegment } from '@core/models/keep-segment'
import type { MediaInfo } from '@core/models/media-info'
import { buildTimelineExportModel } from '@core/export/timeline-model'
import { generateResolveXml } from '@core/export/resolve'
import { writeFile } from 'node:fs/promises'

export function ensureXmlExtension(filePath: string): string {
  return filePath.toLowerCase().endsWith('.xml') ? filePath : `${filePath}.xml`
}

export async function writeResolveXml(
  outputPath: string,
  media: MediaInfo,
  keepSegments: KeepSegment[]
): Promise<string> {
  const finalPath = ensureXmlExtension(outputPath)
  const model = buildTimelineExportModel(media, keepSegments)
  const xml = generateResolveXml(model)
  await writeFile(finalPath, xml, 'utf8')
  return finalPath
}
