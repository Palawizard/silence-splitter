import { existsSync } from 'node:fs'
import path from 'node:path'

export type FfmpegBinaryName = 'ffmpeg' | 'ffprobe'

function packagedResourcesPath(): string | null {
  try {
    const electron = require('electron') as typeof import('electron')
    if (!electron.app?.isPackaged) {
      return null
    }
    return process.resourcesPath
  } catch {
    return null
  }
}

/** Packaged app uses bundled binaries under resources/ffmpeg/bin; dev and scripts fall back to PATH. */
export function resolveFfmpegBinary(name: FfmpegBinaryName): string {
  const resourcesPath = packagedResourcesPath()
  if (resourcesPath) {
    const exe = process.platform === 'win32' ? `${name}.exe` : name
    const bundled = path.join(resourcesPath, 'ffmpeg', 'bin', exe)
    if (existsSync(bundled)) {
      return bundled
    }
  }
  return name
}
