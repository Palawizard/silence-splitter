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

function premiereAudioLevelsFcpXml(): JsonObject {
  return {
    effectcategory: 'audiolevels',
    effectid: 'audiolevels',
    effecttype: 'audiolevels',
    mediatype: 'audio',
    parameter: {
      '@authoringApp': 'PremierePro',
      name: 'Level',
      parameterid: 'level',
      value: '1',
      valuemax: '3.98109',
      valuemin: '0'
    },
    pproBypass: 'false'
  }
}

function premiereClipFcpXml(channels: number): JsonObject {
  return {
    '@premiereChannelType': channels === 2 ? 'stereo' : 'mono',
    ...premiereAudioLevelsFcpXml()
  }
}

function premiereTrackFcpXml(channels: number): JsonObject {
  if (channels === 2) {
    return {
      '@currentExplodedTrackIndex': '0',
      '@premiereTrackType': 'Stereo',
      '@totalExplodedTrackCount': '2',
      enabled: 'TRUE'
    }
  }

  return {
    '@currentExplodedTrackIndex': '0',
    '@premiereTrackType': 'Mono',
    '@totalExplodedTrackCount': '1',
    enabled: 'TRUE'
  }
}

function premiereTimelineFcpXml(model: TimelineExportModel): JsonObject {
  const rate = {
    ntsc: model.rate.ntsc ? 'TRUE' : 'FALSE',
    timebase: String(model.rate.timebase)
  }

  return {
    rate,
    media: {
      video: {
        format: {
          samplecharacteristics: {
            anamorphic: 'FALSE',
            fielddominance: 'none',
            height: String(model.source.height),
            pixelaspectratio: 'square',
            rate,
            width: String(model.source.width)
          }
        }
      }
    }
  }
}

function externalReference(
  fileName: string,
  filePath: string,
  availableDurationFrames: number,
  rate: number,
  channels?: number
): JsonObject {
  const metadata: JsonObject = {}
  if (channels !== undefined) {
    metadata.fcp_xml = {
      media: {
        audio: {
          channelcount: channels
        }
      }
    }
  }

  return {
    OTIO_SCHEMA: 'ExternalReference.1',
    metadata,
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
  const metadata: JsonObject = {
    Premiere_OTIO: { 'Link Group ID': segment.index }
  }
  if (channels !== undefined) {
    metadata.fcp_xml = premiereClipFcpXml(channels)
  }

  return {
    OTIO_SCHEMA: 'Clip.2',
    metadata,
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
      DEFAULT_MEDIA: externalReference(
        name,
        filePath,
        availableDurationFrames,
        rate,
        channels
      )
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

/**
 * Premiere-native OTIO with fcp_xml stereo routing metadata.
 * One timeline audio track per source stream; stereo sidecars stay interleaved.
 */
export function generatePremiereOtio(model: TimelineExportModel): string {
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
    tracks.push(buildAudioTrack(model, source, sourceIndex, rate))
  })

  return JSON.stringify({
    OTIO_SCHEMA: 'Timeline.1',
    metadata: {
      fcp_xml: premiereTimelineFcpXml(model),
      Premiere_OTIO: { 'Premiere OTIO Meta Version': '1.0' }
    },
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

function buildAudioTrack(
  model: TimelineExportModel,
  source: TimelineExportAudioSource,
  sourceIndex: number,
  rate: number
): JsonObject {
  const sourceBounds = model.segments.map((segment) => ({
    segment,
    sourceInFrame: segment.sourceInFrame + source.sourceFrameOffset
  }))
  const availableDurationFrames = Math.max(
    model.source.durationFrames,
    ...model.segments.map(
      (segment) => segment.sourceOutFrame + source.sourceFrameOffset
    )
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

  return track(`Audio ${sourceIndex + 1}`, 'Audio', audioClips, {
    fcp_xml: premiereTrackFcpXml(source.channels)
  })
}
