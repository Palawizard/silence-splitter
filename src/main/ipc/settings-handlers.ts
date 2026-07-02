import type { AppSettings } from '@core/settings'
import { BrowserWindow, ipcMain } from 'electron'
import { getCachedSettings, updateSettings } from '../settings'

function broadcastSettingsChanged(settings: AppSettings): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('settings:changed', settings)
  }
}

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', () => getCachedSettings())

  ipcMain.handle('settings:set', (_event, patch: Partial<AppSettings>) => {
    const next = updateSettings(patch)
    broadcastSettingsChanged(next)
    return next
  })
}
