import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import type { AppLocale } from '@core/settings'
import { applyDocumentLocale, translate, translatePlural, type TranslateVars } from '../i18n'
import { useSettings } from './SettingsProvider'

type I18nContextValue = {
  locale: AppLocale
  t: (key: string, vars?: TranslateVars) => string
  tp: (key: string, count: number, vars?: TranslateVars) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

type I18nProviderProps = {
  children: ReactNode
}

export function I18nProvider({ children }: I18nProviderProps) {
  const { settings } = useSettings()
  const locale = settings.locale

  useEffect(() => {
    applyDocumentLocale(locale)
  }, [locale])

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: (key, vars) => translate(locale, key, vars),
      tp: (key, count, vars) => translatePlural(locale, key, count, vars)
    }),
    [locale]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}
