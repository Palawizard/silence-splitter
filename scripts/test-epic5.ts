import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DEFAULT_APP_SETTINGS,
  mergeAppSettings,
  normalizeAppSettings
} from '../src/core/settings'

function testNormalizeDefaults() {
  assert.deepEqual(normalizeAppSettings(null), DEFAULT_APP_SETTINGS)
  assert.deepEqual(normalizeAppSettings({}), DEFAULT_APP_SETTINGS)
}

function testNormalizePartialAndInvalid() {
  const normalized = normalizeAppSettings({
    locale: 'en',
    theme: 'dark',
    firstRunComplete: true,
    exportNle: 'premiere',
    resolveExportFormat: 'xml',
    premiereExportFormat: 'xml',
    extraField: 'ignored'
  })

  assert.equal(normalized.locale, 'en')
  assert.equal(normalized.theme, 'dark')
  assert.equal(normalized.firstRunComplete, true)
  assert.equal(normalized.exportNle, 'premiere')
  assert.equal(normalized.resolveExportFormat, 'xml')
  assert.equal(normalized.premiereExportFormat, 'xml')

  const invalid = normalizeAppSettings({
    locale: 'de',
    theme: 'neon',
    firstRunComplete: 'yes',
    exportNle: 'final-cut',
    resolveExportFormat: 'json',
    premiereExportFormat: 'json'
  })

  assert.deepEqual(invalid, DEFAULT_APP_SETTINGS)
}

function testMergeSettings() {
  const merged = mergeAppSettings(DEFAULT_APP_SETTINGS, { locale: 'en', theme: 'light' })
  assert.equal(merged.locale, 'en')
  assert.equal(merged.theme, 'light')
  assert.equal(merged.firstRunComplete, false)
}

function testAtomicWriteShape() {
  const dir = mkdtempSync(join(tmpdir(), 'ss-settings-'))
  const filePath = join(dir, 'settings.json')
  const payload = mergeAppSettings(DEFAULT_APP_SETTINGS, { firstRunComplete: true })

  const { writeFileSync, renameSync } = require('node:fs') as typeof import('node:fs')
  const tempPath = `${filePath}.tmp`
  writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  renameSync(tempPath, filePath)

  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown
  assert.deepEqual(normalizeAppSettings(parsed), payload)
  rmSync(dir, { recursive: true, force: true })
}

function main() {
  testNormalizeDefaults()
  testNormalizePartialAndInvalid()
  testMergeSettings()
  testAtomicWriteShape()
  console.log('test:epic5 PASS (4 checks)')
}

main()
