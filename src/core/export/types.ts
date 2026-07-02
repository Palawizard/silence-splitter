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
  audioSources: TimelineExportAudioSource[]
  audioTracks: TimelineExportAudioTrack[]
}

export type TimelineAudioSidecar = {
  sourceStreamIndex: number
  filePath: string
}

export type TimelineExportAudioSource = {
  sourceStreamOrder: number
  sourceStreamIndex: number
  filePath: string
  fileName: string
  fileId: string
  channels: number
  sampleRate: number
}

export type TimelineExportAudioTrack = {
  timelineTrackIndex: number
  sourceTrackIndex: number
  sourceStreamOrder: number
  sourceStreamIndex: number
  fileId: string
  sourceChannelIndex: number
  groupIndex: number
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
