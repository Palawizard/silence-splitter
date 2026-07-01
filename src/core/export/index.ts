import { davinciResolveExporter } from './resolve'

export { buildTimelineExportModel, createTimelineRate } from './timeline-model'
export type {
  ExportFormat,
  TimelineExportModel,
  TimelineExportSegment,
  TimelineExportSource,
  TimelineRate,
  XmlExporter
} from './types'

export const exporters = [davinciResolveExporter]

export function getExporter(format: string) {
  const exporter = exporters.find((e) => e.format === format)
  if (!exporter) {
    throw new Error(`Unknown export format: ${format}`)
  }
  return exporter
}
