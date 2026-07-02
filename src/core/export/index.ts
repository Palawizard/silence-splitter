import { davinciResolveExporter } from './resolve'
import { premiereProExporter } from './premiere'

export { buildTimelineExportModel, createTimelineRate } from './timeline-model'
export type {
  ExportFormat,
  TimelineAudioSidecar,
  TimelineExportAudioSource,
  TimelineExportAudioTrack,
  TimelineExportModel,
  TimelineExportSegment,
  TimelineExportSource,
  TimelineRate,
  XmlExporter
} from './types'

export const exporters = [davinciResolveExporter, premiereProExporter]

export function getExporter(format: string) {
  const exporter = exporters.find((e) => e.format === format)
  if (!exporter) {
    throw new Error(`Unknown export format: ${format}`)
  }
  return exporter
}
