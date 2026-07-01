import type { TimelineExportModel, TimelineRate } from '../types'

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

function provisionalPathUrl(filePath: string): string {
  return `file://localhost/${filePath.replaceAll('\\', '/')}`
}

function sourceFileXml(model: TimelineExportModel, indentation: string): string[] {
  const { source, rate } = model

  return [
    `${indentation}<file id="source-file-1">`,
    `${indentation}  <name>${escapeXml(source.fileName)}</name>`,
    ...rateXml(rate, `${indentation}  `),
    `${indentation}  <duration>${source.durationFrames}</duration>`,
    `${indentation}  <pathurl>${escapeXml(provisionalPathUrl(source.filePath))}</pathurl>`,
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
    `${indentation}  <sourcetrack>`,
    `${indentation}    <mediatype>video</mediatype>`,
    `${indentation}    <trackindex>1</trackindex>`,
    `${indentation}  </sourcetrack>`,
    `${indentation}</clipitem>`
  )

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
    '    </media>',
    '  </sequence>',
    '</xmeml>',
    ''
  )

  return lines.join('\n')
}
