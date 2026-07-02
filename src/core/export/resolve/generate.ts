import type { TimelineExportModel, TimelineRate } from '../types'
import { filePathToUrl } from './path-url'

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function rateXml(rate: TimelineRate, indentation: string): string[] {
  return [
    `${indentation}<rate>`,
    `${indentation}  <timebase>${rate.timebase}</timebase>`,
    `${indentation}  <ntsc>${rate.ntsc ? 'TRUE' : 'FALSE'}</ntsc>`,
    `${indentation}</rate>`
  ]
}

function sourceFileXml(model: TimelineExportModel, indentation: string): string[] {
  const { source, rate } = model
  const lines = [
    `${indentation}<file id="source-file-1">`,
    `${indentation}  <name>${escapeXml(source.fileName)}</name>`,
    ...rateXml(rate, `${indentation}  `),
    `${indentation}  <duration>${source.durationFrames}</duration>`,
    `${indentation}  <pathurl>${escapeXml(filePathToUrl(source.filePath))}</pathurl>`,
    `${indentation}  <timecode>`,
    ...rateXml(rate, `${indentation}    `),
    `${indentation}    <string>00:00:00:00</string>`,
    `${indentation}    <frame>0</frame>`,
    `${indentation}    <displayformat>NDF</displayformat>`,
    `${indentation}  </timecode>`,
    `${indentation}  <media>`,
    `${indentation}    <video>`,
    `${indentation}      <samplecharacteristics>`,
    ...rateXml(rate, `${indentation}        `),
    `${indentation}        <width>${source.width}</width>`,
    `${indentation}        <height>${source.height}</height>`,
    `${indentation}        <anamorphic>FALSE</anamorphic>`,
    `${indentation}        <pixelaspectratio>square</pixelaspectratio>`,
    `${indentation}        <fielddominance>none</fielddominance>`,
    `${indentation}      </samplecharacteristics>`,
    `${indentation}    </video>`
  ]

  lines.push(`${indentation}  </media>`, `${indentation}</file>`)
  return lines
}

function audioSourceFileXml(
  model: TimelineExportModel,
  audioSourceIndex: number,
  indentation: string
): string[] {
  const source = model.source.audioSources[audioSourceIndex]
  return [
    `${indentation}<file id="${source.fileId}">`,
    `${indentation}  <name>${escapeXml(source.fileName)}</name>`,
    ...rateXml(model.rate, `${indentation}  `),
    `${indentation}  <duration>${model.source.durationFrames}</duration>`,
    `${indentation}  <pathurl>${escapeXml(filePathToUrl(source.filePath))}</pathurl>`,
    `${indentation}  <media>`,
    `${indentation}    <audio>`,
    `${indentation}      <samplecharacteristics>`,
    `${indentation}        <samplerate>${source.sampleRate}</samplerate>`,
    `${indentation}        <depth>16</depth>`,
    `${indentation}      </samplecharacteristics>`,
    `${indentation}      <channelcount>${source.channels}</channelcount>`,
    `${indentation}    </audio>`,
    `${indentation}  </media>`,
    `${indentation}</file>`
  ]
}

function linksXml(
  model: TimelineExportModel,
  clipIndex: number,
  indentation: string
): string[] {
  const clipReferences = [
    { id: `video-clip-${clipIndex}`, mediaType: 'video', groupIndex: undefined },
    ...model.source.audioTracks.map(
      (track) => ({
        id: `audio-track-${track.timelineTrackIndex}-clip-${clipIndex}`,
        mediaType: 'audio',
        groupIndex: track.groupIndex
      })
    )
  ]
  const lines: string[] = []

  clipReferences.forEach((clipReference) => {
    lines.push(
      `${indentation}<link>`,
      `${indentation}  <linkclipref>${clipReference.id}</linkclipref>`,
      `${indentation}  <mediatype>${clipReference.mediaType}</mediatype>`,
      ...(clipReference.groupIndex === undefined
        ? []
        : [`${indentation}  <groupindex>${clipReference.groupIndex}</groupindex>`]),
      `${indentation}</link>`
    )
  })

  return lines
}

function videoClipXml(
  model: TimelineExportModel,
  segmentIndex: number,
  indentation: string
): string[] {
  const segment = model.segments[segmentIndex]
  const lines = [
    `${indentation}<clipitem id="video-clip-${segment.index}">`,
    `${indentation}  <name>${escapeXml(model.source.fileName)}</name>`,
    `${indentation}  <duration>${model.source.durationFrames}</duration>`,
    ...rateXml(model.rate, `${indentation}  `),
    `${indentation}  <start>${segment.timelineInFrame}</start>`,
    `${indentation}  <end>${segment.timelineOutFrame}</end>`,
    `${indentation}  <enabled>TRUE</enabled>`,
    `${indentation}  <in>${segment.sourceInFrame}</in>`,
    `${indentation}  <out>${segment.sourceOutFrame}</out>`
  ]

  if (segmentIndex === 0) {
    lines.push(...sourceFileXml(model, `${indentation}  `))
  } else {
    lines.push(`${indentation}  <file id="source-file-1"/>`)
  }

  lines.push(
    ...linksXml(model, segment.index, `${indentation}  `),
    `${indentation}  <sourcetrack>`,
    `${indentation}    <mediatype>video</mediatype>`,
    `${indentation}    <trackindex>1</trackindex>`,
    `${indentation}  </sourcetrack>`,
    `${indentation}</clipitem>`
  )

  return lines
}

function audioClipXml(
  model: TimelineExportModel,
  segmentIndex: number,
  audioTrackIndex: number,
  indentation: string
): string[] {
  const segment = model.segments[segmentIndex]
  const audioTrack = model.source.audioTracks[audioTrackIndex]
  const audioSourceIndex = model.source.audioSources.findIndex(
    (source) => source.sourceStreamIndex === audioTrack.sourceStreamIndex
  )
  const audioSource = model.source.audioSources[audioSourceIndex]
  const pan = audioTrack.sourceChannelIndex === 1 ? -1 : 1
  const sourceInFrame = segment.sourceInFrame + audioSource.sourceFrameOffset
  const sourceOutFrame = segment.sourceOutFrame + audioSource.sourceFrameOffset

  return [
    `${indentation}<clipitem id="audio-track-${audioTrack.timelineTrackIndex}-clip-${segment.index}">`,
    `${indentation}  <name>${escapeXml(model.source.fileName)}</name>`,
    `${indentation}  <duration>${model.source.durationFrames}</duration>`,
    ...rateXml(model.rate, `${indentation}  `),
    `${indentation}  <start>${segment.timelineInFrame}</start>`,
    `${indentation}  <end>${segment.timelineOutFrame}</end>`,
    `${indentation}  <in>${sourceInFrame}</in>`,
    `${indentation}  <out>${sourceOutFrame}</out>`,
    ...(segmentIndex === 0 && audioTrack.sourceChannelIndex === 1
      ? audioSourceFileXml(model, audioSourceIndex, `${indentation}  `)
      : [`${indentation}  <file id="${audioTrack.fileId}"/>`]),
    `${indentation}  <sourcetrack>`,
    `${indentation}    <mediatype>audio</mediatype>`,
    `${indentation}    <trackindex>${audioTrack.sourceTrackIndex}</trackindex>`,
    `${indentation}  </sourcetrack>`,
    ...(audioSource.channels === 2
      ? [
          `${indentation}  <filter>`,
          `${indentation}    <enabled>TRUE</enabled>`,
          `${indentation}    <effect>`,
          `${indentation}      <name>Audio Pan</name>`,
          `${indentation}      <effectid>audiopan</effectid>`,
          `${indentation}      <effecttype>audiopan</effecttype>`,
          `${indentation}      <mediatype>audio</mediatype>`,
          `${indentation}      <parameter>`,
          `${indentation}        <name>Pan</name>`,
          `${indentation}        <parameterid>pan</parameterid>`,
          `${indentation}        <value>${pan}</value>`,
          `${indentation}        <valuemin>-1</valuemin>`,
          `${indentation}        <valuemax>1</valuemax>`,
          `${indentation}      </parameter>`,
          `${indentation}    </effect>`,
          `${indentation}  </filter>`
        ]
      : []),
    ...linksXml(model, segment.index, `${indentation}  `),
    `${indentation}</clipitem>`
  ]
}

function audioTimelineXml(model: TimelineExportModel, indentation: string): string[] {
  if (model.source.audioTracks.length === 0) {
    return []
  }

  const lines = [
    `${indentation}<audio>`,
    `${indentation}  <outputs>`,
    `${indentation}    <group>`,
    `${indentation}      <index>1</index>`,
    `${indentation}      <numchannels>2</numchannels>`,
    `${indentation}      <downmix>0</downmix>`,
    `${indentation}      <channel>`,
    `${indentation}        <index>1</index>`,
    `${indentation}      </channel>`,
    `${indentation}      <channel>`,
    `${indentation}        <index>2</index>`,
    `${indentation}      </channel>`,
    `${indentation}    </group>`,
    `${indentation}  </outputs>`
  ]
  model.source.audioTracks.forEach((track, audioTrackIndex) => {
    lines.push(`${indentation}  <track>`)
    model.segments.forEach((_segment, segmentIndex) => {
      lines.push(...audioClipXml(model, segmentIndex, audioTrackIndex, `${indentation}    `))
    })
    const source = model.source.audioSources.find(
      (candidate) => candidate.sourceStreamIndex === track.sourceStreamIndex
    )
    if (source?.channels === 2) {
      lines.push(
        `${indentation}    <outputchannelindex>${track.sourceChannelIndex}</outputchannelindex>`
      )
    }
    lines.push(
      `${indentation}    <enabled>TRUE</enabled>`,
      `${indentation}    <locked>FALSE</locked>`,
      `${indentation}  </track>`
    )
  })
  lines.push(`${indentation}</audio>`)

  return lines
}

export function generateResolveXml(model: TimelineExportModel): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE xmeml>',
    '<xmeml version="5">',
    '  <sequence id="sequence-1">',
    `    <name>${escapeXml(model.name)}</name>`,
    `    <duration>${model.durationFrames}</duration>`,
    ...rateXml(model.rate, '    '),
    '    <timecode>',
    ...rateXml(model.rate, '      '),
    '      <string>00:00:00:00</string>',
    '      <frame>0</frame>',
    '      <displayformat>NDF</displayformat>',
    '    </timecode>',
    '    <media>',
    '      <video>',
    '        <format>',
    '          <samplecharacteristics>',
    ...rateXml(model.rate, '            '),
    `            <width>${model.source.width}</width>`,
    `            <height>${model.source.height}</height>`,
    '            <anamorphic>FALSE</anamorphic>',
    '            <pixelaspectratio>square</pixelaspectratio>',
    '            <fielddominance>none</fielddominance>',
    '          </samplecharacteristics>',
    '        </format>',
    '        <track>'
  ]

  model.segments.forEach((_segment, index) => {
    lines.push(...videoClipXml(model, index, '          '))
  })

  lines.push('        </track>', '      </video>')
  for (const line of audioTimelineXml(model, '      ')) {
    lines.push(line)
  }
  lines.push('    </media>', '  </sequence>', '</xmeml>', '')

  return lines.join('\n')
}
