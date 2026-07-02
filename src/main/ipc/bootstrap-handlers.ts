import type { AppSettings } from '@core/settings'
import { ipcMain } from 'electron'
import { getCachedSettings } from '../settings'
import { buildThemeState, type ThemeState } from '../theme'

export type AppBootstrap = {
  settings: AppSettings
  theme: ThemeState
}

export function registerBootstrapHandlers(): void {
  ipcMain.on('app:bootstrap-sync', (event) => {
    event.returnValue = {
      settings: getCachedSettings(),
      theme: buildThemeState()
    } satisfies AppBootstrap
  })
}
