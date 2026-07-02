import type { TimelineExportModel } from '../types'
import { premiereFilePathToUrl } from '../resolve/path-url'
import {
  audioSourceFileXml,
  escapeXml,
  rateXml,
  videoClipXml
} from '../xmeml/common'

function premiereLinksXml(
  model: TimelineExportModel,
  clipIndex: number,
  indentation: string
): string[] {
  const clipReferences = [
    { id: `video-clip-${clipIndex}`, mediaType: 'video', groupIndex: undefined },
    ...model.source.audioSources.map((source) => ({
      id: `audio-stream-${source.sourceStreamOrder}-clip-${clipIndex}`,
      mediaType: 'audio',
      groupIndex: source.sourceStreamOrder
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

function audioStreamClipXml(
  model: TimelineExportModel,
  segmentIndex: number,
  audioSourceIndex: number,
  indentation: string
): string[] {
  const segment = model.segments[segmentIndex]
  const audioSource = model.source.audioSources[audioSourceIndex]
  const sourceInFrame = segment.sourceInFrame + audioSource.sourceFrameOffset
  const sourceOutFrame = segment.sourceOutFrame + audioSource.sourceFrameOffset

  return [
    `${indentation}<clipitem id="audio-stream-${audioSource.sourceStreamOrder}-clip-${segment.index}">`,
    `${indentation}  <name>${escapeXml(audioSource.fileName)}</name>`,
    `${indentation}  <duration>${model.source.durationFrames}</duration>`,
    ...rateXml(model.rate, `${indentation}  `),
    `${indentation}  <start>${segment.timelineInFrame}</start>`,
    `${indentation}  <end>${segment.timelineOutFrame}</end>`,
    `${indentation}  <in>${sourceInFrame}</in>`,
    `${indentation}  <out>${sourceOutFrame}</out>`,
    ...(segmentIndex === 0
      ? audioSourceFileXml(model, audioSourceIndex, `${indentation}  `, premiereFilePathToUrl)
      : [`${indentation}  <file id="${audioSource.fileId}"/>`]),
    `${indentation}  <sourcetrack>`,
    `${indentation}    <mediatype>audio</mediatype>`,
    `${indentation}    <trackindex>1</trackindex>`,
    `${indentation}  </sourcetrack>`,
    ...premiereLinksXml(model, segment.index, `${indentation}  `),
    `${indentation}</clipitem>`
  ]
}

function audioTimelineXml(model: TimelineExportModel, indentation: string): string[] {
  if (model.source.audioSources.length === 0) {
    return []
  }

  const lines = [
    `${indentation}<audio>`,
    `${indentation}  <numOutputChannels>2</numOutputChannels>`,
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

  model.source.audioSources.forEach((_source, audioSourceIndex) => {
    lines.push(`${indentation}  <track>`)
    model.segments.forEach((_segment, segmentIndex) => {
      lines.push(...audioStreamClipXml(model, segmentIndex, audioSourceIndex, `${indentation}    `))
    })
    lines.push(
      `${indentation}    <enabled>TRUE</enabled>`,
      `${indentation}    <locked>FALSE</locked>`,
      `${indentation}  </track>`
    )
  })
  lines.push(`${indentation}</audio>`)

  return lines
}

/** FCP7 xmeml for Premiere Pro — localhost paths and one native track per source stream. */
export function generatePremiereXml(model: TimelineExportModel): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE xmeml>',
    '<xmeml version="4">',
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
    lines.push(...videoClipXml(model, index, '          ', premiereFilePathToUrl, premiereLinksXml))
  })

  lines.push('        </track>', '      </video>')
  for (const line of audioTimelineXml(model, '      ')) {
    lines.push(line)
  }
  lines.push('    </media>', '  </sequence>', '</xmeml>', '')

  return lines.join('\n')
}
