import { davinciResolveExporter } from './resolve'

export const exporters = [davinciResolveExporter]

export function getExporter(format: string) {
  const exporter = exporters.find((e) => e.format === format)
  if (!exporter) {
    throw new Error(`Unknown export format: ${format}`)
  }
  return exporter
}
