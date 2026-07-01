import type { KeepSegment } from '../models/keep-segment'
import type { MediaInfo } from '../models/media-info'

export type ExportFormat = 'davinci-resolve' | 'premiere-pro' | 'fcpxml'

export type ExportInput = {
  media: MediaInfo
  segments: KeepSegment[]
  outputPath: string
}

export type XmlExporter = {
  format: ExportFormat
  label: string
  export: (input: ExportInput) => Promise<void>
}
