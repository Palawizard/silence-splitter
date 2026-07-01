export type AudioStreamInfo = {
  index: number
  codec: string
  channels: number
  sampleRate: number
  bitRate?: number
  language?: string
  title?: string
}

export type VideoStreamInfo = {
  index: number
  codec: string
  width: number
  height: number
  frameRate: number
  isVariableFrameRate: boolean
}

export type MediaInfo = {
  filePath: string
  durationSeconds: number
  video?: VideoStreamInfo
  audioStreams: AudioStreamInfo[]
}
