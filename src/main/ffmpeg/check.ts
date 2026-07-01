import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export async function checkFfmpegAvailable(): Promise<{
  ffmpeg: boolean
  ffprobe: boolean
}> {
  const check = async (binary: string): Promise<boolean> => {
    try {
      await execFileAsync(binary, ['-version'])
      return true
    } catch {
      return false
    }
  }

  const [ffmpeg, ffprobe] = await Promise.all([check('ffmpeg'), check('ffprobe')])
  return { ffmpeg, ffprobe }
}
