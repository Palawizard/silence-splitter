import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { SettingsProvider } from './context/SettingsProvider'
import { ThemeProvider } from './context/ThemeProvider'
import './styles/global.css'

function applyBootstrapTheme(): void {
  try {
    const { effectiveTheme } = window.api.getBootstrap().theme
    document.documentElement.dataset.theme = effectiveTheme
    document.documentElement.style.colorScheme = effectiveTheme
  } catch {
    // index.html inline script already applied the OS theme.
  }
}

applyBootstrapTheme()

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <SettingsProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </SettingsProvider>
  </StrictMode>
)
