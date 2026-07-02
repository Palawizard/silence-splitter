import { useEffect, type ReactNode } from 'react'

type ThemeProviderProps = {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  useEffect(() => {
    return window.api.onThemeChanged((state) => {
      document.documentElement.dataset.theme = state.effectiveTheme
      document.documentElement.style.colorScheme = state.effectiveTheme
    })
  }, [])

  return children
}
