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
  videoStreamIndex: number
  width: number
  height: number
  audioTracks: TimelineExportAudioTrack[]
}

export type TimelineExportAudioTrack = {
  timelineTrackIndex: number
  sourceStreamIndex: number
  sourceTrackIndex: number
  codec: string
  channels: number
  sampleRate: number
  language?: string
  title?: string
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
