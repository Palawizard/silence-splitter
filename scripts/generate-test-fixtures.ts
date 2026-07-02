import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const fixturesDirectory = resolve('test/fixtures')
mkdirSync(fixturesDirectory, { recursive: true })

function generate(name: string, inputs: string[], maps: string[]): void {
  const outputPath = resolve(fixturesDirectory, name)
  execFileSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      ...inputs,
      ...maps,
      '-t',
      '3',
      '-c:v',
      'mpeg4',
      '-q:v',
      '5',
      '-c:a',
      'aac',
      outputPath
    ],
    { stdio: 'inherit' }
  )
  console.log(`Generated ${name}`)
}

const videoInput = ['-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=25:duration=3']
const firstAudioInput = ['-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=3']

generate('single-track.mp4', [...videoInput, ...firstAudioInput], ['-map', '0:v:0', '-map', '1:a:0'])
generate(
  'multi-track.mp4',
  [
    ...videoInput,
    ...firstAudioInput,
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=880:sample_rate=48000:duration=3'
  ],
  ['-map', '0:v:0', '-map', '1:a:0', '-map', '2:a:0']
)
generate('variable-fps.mp4', [...videoInput, ...firstAudioInput], [
  '-map',
  '0:v:0',
  '-map',
  '1:a:0'
])
