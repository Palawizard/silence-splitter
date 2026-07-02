import { createWriteStream, existsSync } from 'node:fs'
import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const FFMPEG_RELEASE_URL =
  'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip'

const OUTPUT_DIR = resolve('resources/ffmpeg')
const BIN_DIR = join(OUTPUT_DIR, 'bin')

async function main(): Promise<void> {
  const ffmpegExe = join(BIN_DIR, 'ffmpeg.exe')
  const ffprobeExe = join(BIN_DIR, 'ffprobe.exe')

  if (existsSync(ffmpegExe) && existsSync(ffprobeExe)) {
    console.log('Bundled ffmpeg already present')
    return
  }

  if (process.platform !== 'win32') {
    throw new Error('ensure-ffmpeg supports Windows packaging only')
  }

  await mkdir(BIN_DIR, { recursive: true })

  const zipPath = join(tmpdir(), `silence-splitter-ffmpeg-${Date.now()}.zip`)
  const extractDir = join(tmpdir(), `silence-splitter-ffmpeg-extract-${Date.now()}`)

  try {
    console.log('Downloading ffmpeg for Windows x64...')
    const response = await fetch(FFMPEG_RELEASE_URL)
    if (!response.ok || !response.body) {
      throw new Error(`ffmpeg download failed with status ${response.status}`)
    }

    await pipeline(response.body, createWriteStream(zipPath))

    console.log('Extracting ffmpeg...')
    await mkdir(extractDir, { recursive: true })
    await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force`
    ])

    const binSource = await findBinDirectory(extractDir)
    await copyBinContents(binSource, BIN_DIR)

    const licenseSource = join(binSource, '..', 'LICENSE')
    if (existsSync(licenseSource)) {
      await cp(licenseSource, join(OUTPUT_DIR, 'LICENSE.txt'), { force: true })
    }

    console.log(`Bundled ffmpeg ready in ${BIN_DIR}`)
  } finally {
    await rm(zipPath, { force: true })
    await rm(extractDir, { force: true, recursive: true })
  }
}

async function findBinDirectory(root: string): Promise<string> {
  const directBin = join(root, 'bin')
  if (existsSync(join(directBin, 'ffmpeg.exe'))) {
    return directBin
  }

  for (const entry of await readdir(root)) {
    const candidate = join(root, entry, 'bin')
    if (existsSync(join(candidate, 'ffmpeg.exe'))) {
      return candidate
    }
  }

  throw new Error('Could not find ffmpeg.exe in the downloaded archive')
}

async function copyBinContents(sourceDir: string, destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true })

  for (const entry of await readdir(sourceDir)) {
    const lower = entry.toLowerCase()
    const isBinary = lower === 'ffmpeg.exe' || lower === 'ffprobe.exe'
    const isDll = lower.endsWith('.dll')
    if (!isBinary && !isDll) {
      continue
    }

    const sourcePath = join(sourceDir, entry)
    const info = await stat(sourcePath)
    if (info.isFile()) {
      await cp(sourcePath, join(destDir, entry), { force: true })
    }
  }
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
