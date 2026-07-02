import assert from 'node:assert/strict'
import type { AppLocale } from '../src/core/settings'
import {
  getPresetLabel,
  translate,
  translatePlural
} from '../src/renderer/src/i18n/index.ts'

function testTranslateFr() {
  assert.equal(translate('fr', 'app.title'), 'Silence Splitter')
  assert.equal(translate('en', 'app.title'), 'Silence Splitter')
  assert.equal(translate('en', 'source.chooseFile'), 'Choose an MP4 file')
}

function testInterpolation() {
  assert.equal(
    translate('fr', 'preview.threshold', { db: -42 }),
    'Seuil -42 dB'
  )
}

function testPlural() {
  assert.equal(translatePlural('fr', 'preview.segmentCount', 1), '1 segment conservé')
  assert.equal(translatePlural('fr', 'preview.segmentCount', 3), '3 segments conservés')
  assert.equal(translatePlural('en', 'preview.segmentCount', 1), '1 segment kept')
}

function testPresetLabels() {
  const locales: AppLocale[] = ['fr', 'en']
  for (const locale of locales) {
    assert.ok(getPresetLabel(locale, 'gaming-energetic').length > 0)
    assert.ok(getPresetLabel(locale, 'tiktok-ultra-cut').length > 0)
  }
}

function testFallback() {
  assert.equal(translate('en', 'missing.key'), 'missing.key')
}

function main() {
  testTranslateFr()
  testInterpolation()
  testPlural()
  testPresetLabels()
  testFallback()
  console.log('test:epic7 PASS (5 checks)')
}

main()
