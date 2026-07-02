import type { TimelineExportModel } from '../types'
import { premiereFilePathToUrl } from '../resolve/path-url'
import {
  audioPanFilterXml,
  audioSourceFileXml,
  escapeXml,
  linksXml,
  rateXml,
  videoClipXml
} from '../xmeml/common'

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
    `${indentation}  <name>${escapeXml(audioSource.fileName)}</name>`,
    `${indentation}  <duration>${model.source.durationFrames}</duration>`,
    ...rateXml(model.rate, `${indentation}  `),
    `${indentation}  <start>${segment.timelineInFrame}</start>`,
    `${indentation}  <end>${segment.timelineOutFrame}</end>`,
    `${indentation}  <in>${sourceInFrame}</in>`,
    `${indentation}  <out>${sourceOutFrame}</out>`,
    ...(segmentIndex === 0 && audioTrack.sourceChannelIndex === 1
      ? audioSourceFileXml(model, audioSourceIndex, `${indentation}  `, premiereFilePathToUrl)
      : [`${indentation}  <file id="${audioTrack.fileId}"/>`]),
    `${indentation}  <sourcetrack>`,
    `${indentation}    <mediatype>audio</mediatype>`,
    `${indentation}    <trackindex>${audioTrack.sourceTrackIndex}</trackindex>`,
    `${indentation}  </sourcetrack>`,
    ...(audioSource.channels === 2
      ? audioPanFilterXml(pan, `${indentation}  `, true)
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

/**
 * FCP7 xmeml for Premiere Pro.
 * Stereo sidecars must be split to paired mono timeline tracks with explicit pan:
 * Premiere often downmixes single-track stereo XML imports to centered dual-mono.
 */
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
    lines.push(...videoClipXml(model, index, '          ', premiereFilePathToUrl))
  })

  lines.push('        </track>', '      </video>')
  for (const line of audioTimelineXml(model, '      ')) {
    lines.push(line)
  }
  lines.push('    </media>', '  </sequence>', '</xmeml>', '')

  return lines.join('\n')
}
