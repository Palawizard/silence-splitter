import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

type PackageConfig = {
  version: string
  scripts: Record<string, string>
  build?: {
    appId?: string
    publish?: { provider?: string; owner?: string; repo?: string }
  }
}

async function main(): Promise<void> {
  const packageConfig = JSON.parse(await readFile(resolve('package.json'), 'utf8')) as PackageConfig
  const updater = await readFile(resolve('src/main/updater.ts'), 'utf8')
  const preload = await readFile(resolve('src/preload/index.ts'), 'utf8')
  const french = JSON.parse(await readFile(resolve('src/renderer/src/i18n/fr.json'), 'utf8'))
  const english = JSON.parse(await readFile(resolve('src/renderer/src/i18n/en.json'), 'utf8'))

  for (const asset of ['build/icon.svg', 'build/icon.png', 'build/icon.ico']) {
    await access(resolve(asset))
  }

  const extraResources = JSON.stringify(packageConfig.build?.extraResources ?? [])
  if (!extraResources.includes('resources/ffmpeg')) {
    throw new Error('Missing bundled ffmpeg extraResources configuration')
  }

  if (!packageConfig.scripts['ensure:ffmpeg']) {
    throw new Error('Missing ensure:ffmpeg script')
  }

  await access(resolve('src/main/ffmpeg/resolve-binary.ts'))

  if (
    packageConfig.version !== '1.0.0-beta.1' ||
    packageConfig.build?.appId !== 'com.palawizard.silence-splitter' ||
    packageConfig.build.publish?.provider !== 'github' ||
    !packageConfig.scripts.dist
  ) {
    throw new Error('Packaging configuration is incomplete')
  }

  for (const channel of ['update:get-status', 'update:check', 'update:download', 'update:install']) {
    if (!updater.includes(channel) || !preload.includes(channel)) {
      throw new Error(`Missing update channel: ${channel}`)
    }
  }

  if (!french.update?.restart || !english.update?.restart) {
    throw new Error('Update translations are incomplete')
  }

  console.log('test:epic8 PASS (icon, packaging, updater, and translations)')
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
