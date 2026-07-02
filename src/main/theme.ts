import { BrowserWindow, ipcMain, nativeTheme } from 'electron'
import type { ThemeMode } from '@core/settings'
import { getCachedSettings } from './settings'

export type EffectiveTheme = 'light' | 'dark'

export type ThemeState = {
  effectiveTheme: EffectiveTheme
  themeMode: ThemeMode
}

export function resolveEffectiveTheme(mode?: ThemeMode): EffectiveTheme {
  const themeMode = mode ?? getCachedSettings().theme

  if (themeMode === 'dark') {
    return 'dark'
  }

  if (themeMode === 'light') {
    return 'light'
  }

  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
}

export function applyNativeThemeSource(mode?: ThemeMode): void {
  const themeMode = mode ?? getCachedSettings().theme
  nativeTheme.themeSource = themeMode === 'system' ? 'system' : themeMode
}

export function windowBackgroundColor(theme: EffectiveTheme): string {
  return theme === 'dark' ? '#18181b' : '#f4f4f5'
}

function buildThemeState(): ThemeState {
  const settings = getCachedSettings()
  return {
    effectiveTheme: resolveEffectiveTheme(settings.theme),
    themeMode: settings.theme
  }
}

function broadcastThemeChanged(): void {
  const state = buildThemeState()

  for (const window of BrowserWindow.getAllWindows()) {
    window.setBackgroundColor(windowBackgroundColor(state.effectiveTheme))
    window.webContents.send('theme:changed', state)
  }
}

export function syncThemeToWindows(): void {
  applyNativeThemeSource()
  broadcastThemeChanged()
}

export function registerThemeHandlers(): void {
  ipcMain.handle('theme:get', () => buildThemeState())

  nativeTheme.on('updated', () => {
    if (getCachedSettings().theme === 'system') {
      broadcastThemeChanged()
    }
  })
}
