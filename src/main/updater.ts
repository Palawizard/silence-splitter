import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available' }
  | { state: 'downloading'; percent: number; version: string }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }

let currentStatus: UpdateStatus = { state: 'idle' }
let availableVersion = ''

function publish(status: UpdateStatus): void {
  currentStatus = status
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('update:status', status)
  }
}

export function registerUpdater(): void {
  ipcMain.handle('update:get-status', () => currentStatus)
  ipcMain.handle('update:check', async () => {
    if (!app.isPackaged) {
      return currentStatus
    }
    await autoUpdater.checkForUpdates()
    return currentStatus
  })
  ipcMain.handle('update:download', async () => {
    if (app.isPackaged) {
      await autoUpdater.downloadUpdate()
    }
  })
  ipcMain.on('update:install', () => {
    if (app.isPackaged) {
      autoUpdater.quitAndInstall(false, true)
    }
  })

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('checking-for-update', () => publish({ state: 'checking' }))
  autoUpdater.on('update-available', (info) => {
    availableVersion = info.version
    publish({ state: 'available', version: info.version })
  })
  autoUpdater.on('update-not-available', () => publish({ state: 'not-available' }))
  autoUpdater.on('download-progress', (progress) =>
    publish({
      state: 'downloading',
      percent: Math.round(progress.percent),
      version: availableVersion
    })
  )
  autoUpdater.on('update-downloaded', (info) =>
    publish({ state: 'downloaded', version: info.version })
  )
  autoUpdater.on('error', (error) => publish({ state: 'error', message: error.message }))
}

export function checkForUpdatesOnStartup(): void {
  if (!app.isPackaged) {
    return
  }
  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch((error: unknown) => {
      publish({ state: 'error', message: error instanceof Error ? error.message : String(error) })
    })
  }, 3000)
}
