import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import type { AppSettings } from '@core/settings'
import { DEFAULT_APP_SETTINGS } from '@core/settings'

type SettingsContextValue = {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>
  isReady: boolean
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

type SettingsProviderProps = {
  children: ReactNode
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      return window.api.getBootstrap().settings
    } catch {
      return DEFAULT_APP_SETTINGS
    }
  })

  useEffect(() => {
    void window.api.getSettings().then(setSettings).catch(() => undefined)

    const unsubscribe = window.api.onSettingsChanged((next) => {
      setSettings(next)
    })

    return unsubscribe
  }, [])

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const next = await window.api.setSettings(patch)
    setSettings(next)
    return next
  }, [])

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      updateSettings,
      isReady: true
    }),
    [settings, updateSettings]
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider')
  }
  return context
}
