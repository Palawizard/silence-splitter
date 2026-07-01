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

  source.audioTracks.forEach((track) => {
    lines.push(
      `${indentation}    <audio>`,
      `${indentation}      <samplecharacteristics>`,
      `${indentation}        <samplerate>${track.sampleRate}</samplerate>`,
      `${indentation}        <depth>16</depth>`,
      `${indentation}      </samplecharacteristics>`,
      `${indentation}      <channelcount>${track.channels}</channelcount>`,
      `${indentation}    </audio>`
    )
  })

  lines.push(`${indentation}  </media>`, `${indentation}</file>`)
  return lines
}

function linksXml(
  model: TimelineExportModel,
  clipIndex: number,
  indentation: string
): string[] {
  const lines = [
    `${indentation}<link>`,
    `${indentation}  <mediatype>video</mediatype>`,
    `${indentation}  <trackindex>1</trackindex>`,
    `${indentation}  <clipindex>${clipIndex}</clipindex>`,
    `${indentation}</link>`
  ]

  model.source.audioTracks.forEach((track) => {
    lines.push(
      `${indentation}<link>`,
      `${indentation}  <mediatype>audio</mediatype>`,
      `${indentation}  <trackindex>${track.timelineTrackIndex}</trackindex>`,
      `${indentation}  <clipindex>${clipIndex}</clipindex>`,
      `${indentation}  <groupindex>1</groupindex>`,
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

  return [
    `${indentation}<clipitem id="audio-track-${audioTrack.timelineTrackIndex}-clip-${segment.index}">`,
    `${indentation}  <name>${escapeXml(model.source.fileName)}</name>`,
    `${indentation}  <duration>${model.source.durationFrames}</duration>`,
    ...rateXml(model.rate, `${indentation}  `),
    `${indentation}  <start>${segment.timelineInFrame}</start>`,
    `${indentation}  <end>${segment.timelineOutFrame}</end>`,
    `${indentation}  <in>${segment.sourceInFrame}</in>`,
    `${indentation}  <out>${segment.sourceOutFrame}</out>`,
    `${indentation}  <file id="source-file-1"/>`,
    `${indentation}  <sourcetrack>`,
    `${indentation}    <mediatype>audio</mediatype>`,
    `${indentation}    <trackindex>${audioTrack.sourceTrackIndex}</trackindex>`,
    `${indentation}  </sourcetrack>`,
    `${indentation}</clipitem>`
  ]
}

function audioTimelineXml(model: TimelineExportModel, indentation: string): string[] {
  if (model.source.audioTracks.length === 0) {
    return []
  }

  const primarySampleRate = model.source.audioTracks[0].sampleRate
  const lines = [
    `${indentation}<audio>`,
    `${indentation}  <format>`,
    `${indentation}    <samplecharacteristics>`,
    `${indentation}      <depth>16</depth>`,
    `${indentation}      <samplerate>${primarySampleRate}</samplerate>`,
    `${indentation}    </samplecharacteristics>`,
    `${indentation}  </format>`,
    `${indentation}  <outputs>`
  ]

  let outputChannelIndex = 1
  model.source.audioTracks.forEach((track) => {
    lines.push(
      `${indentation}    <group>`,
      `${indentation}      <index>${track.timelineTrackIndex}</index>`,
      `${indentation}      <numchannels>${track.channels}</numchannels>`
    )
    for (let channel = 0; channel < track.channels; channel += 1) {
      lines.push(
        `${indentation}      <channel>`,
        `${indentation}        <index>${outputChannelIndex}</index>`,
        `${indentation}      </channel>`
      )
      outputChannelIndex += 1
    }
    lines.push(`${indentation}    </group>`)
  })

  lines.push(`${indentation}  </outputs>`)
  model.source.audioTracks.forEach((_track, audioTrackIndex) => {
    lines.push(`${indentation}  <track>`)
    model.segments.forEach((_segment, segmentIndex) => {
      lines.push(...audioClipXml(model, segmentIndex, audioTrackIndex, `${indentation}    `))
    })
    lines.push(`${indentation}  </track>`)
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

  lines.push(
    '        </track>',
    '      </video>',
    ...audioTimelineXml(model, '      '),
    '    </media>',
    '  </sequence>',
    '</xmeml>',
    ''
  )

  return lines.join('\n')
}
