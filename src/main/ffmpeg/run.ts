import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export async function runCommand(
  binary: string,
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync(binary, args, {
    maxBuffer: 50 * 1024 * 1024
  })
  return { stdout: stdout.toString(), stderr: stderr.toString() }
}

export function runCommandBuffer(binary: string, args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const chunks: Buffer[] = []
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    child.on('error', reject)

    child.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks))
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.trim()}`))
      }
    })
  })
}

export function runCommandChunks(
  binary: string,
  args: string[],
  onChunk: (chunk: Buffer) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => {
      onChunk(chunk)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.trim()}`))
      }
    })
  })
}
