import type { TimelineExportModel, TimelineRate } from '../types'
import { filePathToUrl, type MediaPathToUrl } from '../resolve/path-url'

export function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function audioPanFilterXml(
  pan: number,
  indentation: string,
  includeEffectCategory = false
): string[] {
  return [
    `${indentation}<filter>`,
    `${indentation}  <enabled>TRUE</enabled>`,
    `${indentation}  <effect>`,
    `${indentation}    <name>Audio Pan</name>`,
    `${indentation}    <effectid>audiopan</effectid>`,
    `${indentation}    <effecttype>audiopan</effecttype>`,
    `${indentation}    <mediatype>audio</mediatype>`,
    ...(includeEffectCategory
      ? [`${indentation}    <effectcategory>audiopan</effectcategory>`]
      : []),
    `${indentation}    <parameter>`,
    `${indentation}      <name>Pan</name>`,
    `${indentation}      <parameterid>pan</parameterid>`,
    `${indentation}      <value>${pan}</value>`,
    `${indentation}      <valuemin>-1</valuemin>`,
    `${indentation}      <valuemax>1</valuemax>`,
    `${indentation}    </parameter>`,
    `${indentation}  </effect>`,
    `${indentation}</filter>`
  ]
}

export function rateXml(rate: TimelineRate, indentation: string): string[] {
  return [
    `${indentation}<rate>`,
    `${indentation}  <timebase>${rate.timebase}</timebase>`,
    `${indentation}  <ntsc>${rate.ntsc ? 'TRUE' : 'FALSE'}</ntsc>`,
    `${indentation}</rate>`
  ]
}

export function sourceFileXml(
  model: TimelineExportModel,
  indentation: string,
  pathToUrl: MediaPathToUrl = filePathToUrl
): string[] {
  const { source, rate } = model
  const lines = [
    `${indentation}<file id="source-file-1">`,
    `${indentation}  <name>${escapeXml(source.fileName)}</name>`,
    ...rateXml(rate, `${indentation}  `),
    `${indentation}  <duration>${source.durationFrames}</duration>`,
    `${indentation}  <pathurl>${escapeXml(pathToUrl(source.filePath))}</pathurl>`,
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
    `${indentation}    </video>`,
    `${indentation}  </media>`,
    `${indentation}</file>`
  ]

  return lines
}

export function audioSourceFileXml(
  model: TimelineExportModel,
  audioSourceIndex: number,
  indentation: string,
  pathToUrl: MediaPathToUrl = filePathToUrl
): string[] {
  const source = model.source.audioSources[audioSourceIndex]
  return [
    `${indentation}<file id="${source.fileId}">`,
    `${indentation}  <name>${escapeXml(source.fileName)}</name>`,
    ...rateXml(model.rate, `${indentation}  `),
    `${indentation}  <duration>${model.source.durationFrames}</duration>`,
    `${indentation}  <pathurl>${escapeXml(pathToUrl(source.filePath))}</pathurl>`,
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

export function linksXml(
  model: TimelineExportModel,
  clipIndex: number,
  indentation: string
): string[] {
  const clipReferences = [
    { id: `video-clip-${clipIndex}`, mediaType: 'video', groupIndex: undefined },
    ...model.source.audioTracks.map((track) => ({
      id: `audio-track-${track.timelineTrackIndex}-clip-${clipIndex}`,
      mediaType: 'audio',
      groupIndex: track.groupIndex
    }))
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

export function videoClipXml(
  model: TimelineExportModel,
  segmentIndex: number,
  indentation: string,
  pathToUrl: MediaPathToUrl = filePathToUrl
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
    lines.push(...sourceFileXml(model, `${indentation}  `, pathToUrl))
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
