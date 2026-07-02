import { useEffect, type ReactNode } from 'react'

type ThemeProviderProps = {
  children: ReactNode
}

function applyEffectiveTheme(effectiveTheme: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = effectiveTheme
  document.documentElement.style.colorScheme = effectiveTheme
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  useEffect(() => {
    applyEffectiveTheme(window.api.getBootstrap().theme.effectiveTheme)

    return window.api.onThemeChanged((state) => {
      applyEffectiveTheme(state.effectiveTheme)
    })
  }, [])

  return children
}
