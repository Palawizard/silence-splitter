import type {
  TimelineExportAudioSource,
  TimelineExportModel,
  TimelineExportSegment
} from '../types'

type JsonObject = Record<string, unknown>

function rationalTime(value: number, rate: number): JsonObject {
  return {
    OTIO_SCHEMA: 'RationalTime.1',
    rate,
    value
  }
}

function timeRange(startFrame: number, durationFrames: number, rate: number): JsonObject {
  return {
    OTIO_SCHEMA: 'TimeRange.1',
    duration: rationalTime(durationFrames, rate),
    start_time: rationalTime(startFrame, rate)
  }
}

function externalReference(
  fileName: string,
  filePath: string,
  availableDurationFrames: number,
  rate: number
): JsonObject {
  return {
    OTIO_SCHEMA: 'ExternalReference.1',
    metadata: {},
    name: fileName,
    available_range: timeRange(0, availableDurationFrames, rate),
    available_image_bounds: null,
    target_url: filePath
  }
}

function clip(
  name: string,
  filePath: string,
  segment: TimelineExportSegment,
  sourceInFrame: number,
  availableDurationFrames: number,
  rate: number,
  channels?: number
): JsonObject {
  const metadata: JsonObject = { 'Link Group ID': segment.index }
  if (channels !== undefined) {
    metadata.Channels = Array.from({ length: channels }, (_unused, channelIndex) => ({
      'Source Channel ID': channelIndex,
      'Source Track ID': 0
    }))
  }

  return {
    OTIO_SCHEMA: 'Clip.2',
    metadata: { Resolve_OTIO: metadata },
    name,
    source_range: timeRange(
      sourceInFrame,
      segment.timelineOutFrame - segment.timelineInFrame,
      rate
    ),
    effects: [],
    markers: [],
    enabled: true,
    media_references: {
      DEFAULT_MEDIA: externalReference(name, filePath, availableDurationFrames, rate)
    },
    active_media_reference_key: 'DEFAULT_MEDIA'
  }
}

function track(
  name: string,
  kind: 'Video' | 'Audio',
  children: JsonObject[],
  metadata: JsonObject
): JsonObject {
  return {
    OTIO_SCHEMA: 'Track.1',
    metadata,
    name,
    source_range: null,
    effects: [],
    markers: [],
    enabled: true,
    children,
    kind
  }
}

function audioType(source: TimelineExportAudioSource): string {
  if (source.channels === 1) {
    return 'Mono'
  }
  if (source.channels === 2) {
    return 'Stereo'
  }
  return `Adaptive ${source.channels}`
}

export function generateResolveOtio(model: TimelineExportModel): string {
  const rate = model.rate.framesPerSecond
  const videoClips = model.segments.map((segment) =>
    clip(
      model.source.fileName,
      model.source.filePath,
      segment,
      segment.sourceInFrame,
      model.source.durationFrames,
      rate
    )
  )
  const tracks = [track('Video 1', 'Video', videoClips, {})]

  model.source.audioSources.forEach((source, sourceIndex) => {
    const sourceBounds = model.segments.map((segment) => ({
      segment,
      sourceInFrame: segment.sourceInFrame + source.sourceFrameOffset,
      sourceOutFrame: segment.sourceOutFrame + source.sourceFrameOffset
    }))
    const availableDurationFrames = Math.max(
      model.source.durationFrames,
      ...sourceBounds.map((bounds) => bounds.sourceOutFrame)
    )
    const audioClips = sourceBounds.map(({ segment, sourceInFrame }) =>
      clip(
        source.fileName,
        source.filePath,
        segment,
        sourceInFrame,
        availableDurationFrames,
        rate,
        source.channels
      )
    )
    tracks.push(
      track(`Audio ${sourceIndex + 1}`, 'Audio', audioClips, {
        Resolve_OTIO: { 'Audio Type': audioType(source) }
      })
    )
  })

  return JSON.stringify({
    OTIO_SCHEMA: 'Timeline.1',
    metadata: { Resolve_OTIO: { 'Resolve OTIO Meta Version': '1.0' } },
    name: model.name,
    global_start_time: rationalTime(0, rate),
    tracks: {
      OTIO_SCHEMA: 'Stack.1',
      metadata: {},
      name: '',
      source_range: null,
      effects: [],
      markers: [],
      enabled: true,
      children: tracks
    }
  })
}
