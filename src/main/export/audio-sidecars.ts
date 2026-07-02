import type { TimelineAudioSidecar } from '@core/export/types'
import type { MediaInfo } from '@core/models/media-info'
import { mkdir } from 'node:fs/promises'
import { dirname, join, parse } from 'node:path'
import { runCommand } from '../ffmpeg/run'

export type PreparedAudioSidecars = {
  sidecars: TimelineAudioSidecar[]
  directoryPath?: string
}

function sidecarExtension(codec: string): 'm4a' | 'mov' {
  return codec.toLowerCase() === 'aac' ? 'm4a' : 'mov'
}

export async function prepareAudioSidecars(
  xmlPath: string,
  media: MediaInfo
): Promise<PreparedAudioSidecars> {
  if (media.audioStreams.length === 0) {
    return { sidecars: [] }
  }

  const xmlName = parse(xmlPath).name
  const directoryPath = join(dirname(xmlPath), `${xmlName}-audio`)
  await mkdir(directoryPath, { recursive: true })

  const sidecars: TimelineAudioSidecar[] = []
  for (const [index, stream] of media.audioStreams.entries()) {
    const extension = sidecarExtension(stream.codec)
    const filePath = join(
      directoryPath,
      `${xmlName}-track-${String(index + 1).padStart(2, '0')}.${extension}`
    )
    await runCommand('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      media.filePath,
      '-map',
      `0:${stream.index}`,
      '-vn',
      '-c:a',
      'copy',
      '-map_metadata',
      '-1',
      '-movflags',
      '+faststart',
      filePath
    ])
    sidecars.push({ sourceStreamIndex: stream.index, filePath })
  }

  return { sidecars, directoryPath }
}
