import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { SettingsProvider } from './context/SettingsProvider'
import { I18nProvider } from './context/I18nProvider'
import { ThemeProvider } from './context/ThemeProvider'
import { applyDocumentLocale } from './i18n'
import './styles/global.css'

function applyBootstrapTheme(): void {
  try {
    const bootstrap = window.api.getBootstrap()
    document.documentElement.dataset.theme = bootstrap.theme.effectiveTheme
    document.documentElement.style.colorScheme = bootstrap.theme.effectiveTheme
    applyDocumentLocale(bootstrap.settings.locale)
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
      <I18nProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </I18nProvider>
    </SettingsProvider>
  </StrictMode>
)
