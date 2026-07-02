import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DEFAULT_APP_SETTINGS,
  mergeAppSettings,
  normalizeAppSettings,
  type AppSettings
} from '@core/settings'

const SETTINGS_FILE_NAME = 'settings.json'

function settingsPath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE_NAME)
}

function settingsTempPath(): string {
  return `${settingsPath()}.tmp`
}

let cachedSettings: AppSettings = { ...DEFAULT_APP_SETTINGS }

export function getCachedSettings(): AppSettings {
  return cachedSettings
}

export function loadSettings(): AppSettings {
  const path = settingsPath()

  if (!existsSync(path)) {
    cachedSettings = { ...DEFAULT_APP_SETTINGS }
    return cachedSettings
  }

  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown
    cachedSettings = normalizeAppSettings(raw)
  } catch {
    cachedSettings = { ...DEFAULT_APP_SETTINGS }
  }

  return cachedSettings
}

export function saveSettings(next: AppSettings): AppSettings {
  const userDataDir = app.getPath('userData')
  if (!existsSync(userDataDir)) {
    mkdirSync(userDataDir, { recursive: true })
  }

  const normalized = normalizeAppSettings(next)
  const tempPath = settingsTempPath()
  writeFileSync(tempPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
  renameSync(tempPath, settingsPath())
  cachedSettings = normalized
  return cachedSettings
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  return saveSettings(mergeAppSettings(cachedSettings, patch))
}

export function initSettings(): AppSettings {
  return loadSettings()
}
