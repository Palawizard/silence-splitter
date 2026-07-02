import { useEffect, type ReactNode } from 'react'

type ThemeProviderProps = {
  children: ReactNode
}

function applyEffectiveTheme(effectiveTheme: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = effectiveTheme
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  useEffect(() => {
    let active = true

    window.api.getTheme().then((state) => {
      if (active) {
        applyEffectiveTheme(state.effectiveTheme)
      }
    })

    const unsubscribe = window.api.onThemeChanged((state) => {
      applyEffectiveTheme(state.effectiveTheme)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return children
}
