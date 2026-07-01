export type ExportFormat = 'davinci-resolve' | 'premiere-pro' | 'fcpxml'

export type TimelineRate = {
  framesPerSecond: number
  timebase: number
  ntsc: boolean
}

export type TimelineExportSource = {
  filePath: string
  fileName: string
  durationFrames: number
  width: number
  height: number
}

export type TimelineExportSegment = {
  index: number
  sourceInFrame: number
  sourceOutFrame: number
  timelineInFrame: number
  timelineOutFrame: number
}

export type TimelineExportModel = {
  name: string
  rate: TimelineRate
  source: TimelineExportSource
  segments: TimelineExportSegment[]
  durationFrames: number
}

export type XmlExporter = {
  format: ExportFormat
  label: string
  fileExtension: 'xml'
  generate: (model: TimelineExportModel) => string
}
