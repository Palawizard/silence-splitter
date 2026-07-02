import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import pngToIco from 'png-to-ico'
import sharp from 'sharp'

async function main(): Promise<void> {
  const sourcePath = resolve('build/icon.svg')
  const outputDirectory = resolve('build/icons')
  const sizes = [16, 24, 32, 48, 64, 128, 256, 512]

  await mkdir(outputDirectory, { recursive: true })
  const source = await readFile(sourcePath)
  const pngPaths = await Promise.all(
    sizes.map(async (size) => {
      const outputPath = resolve(outputDirectory, `${size}x${size}.png`)
      await sharp(source).resize(size, size).png().toFile(outputPath)
      return outputPath
    })
  )

  await sharp(source).resize(512, 512).png().toFile(resolve('build/icon.png'))
  const ico = await pngToIco(pngPaths.filter((path) => !path.includes('512x512')))
  await writeFile(resolve('build/icon.ico'), ico)
  console.log('Generated PNG and ICO assets from build/icon.svg')
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
