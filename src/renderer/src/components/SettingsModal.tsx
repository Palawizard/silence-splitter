import type { AppLocale, ThemeMode } from '@core/settings'
import { useI18n } from '../context/I18nProvider'
import { useSettings } from '../context/SettingsProvider'

type SettingsModalProps = {
  onClose: () => void
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { t } = useI18n()
  const { settings, updateSettings } = useSettings()

  function handleLocaleChange(nextLocale: AppLocale) {
    void updateSettings({ locale: nextLocale })
  }

  function handleThemeChange(nextTheme: ThemeMode) {
    void updateSettings({ theme: nextTheme })
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="settings-title">{t('settings.title')}</h2>
          <button type="button" className="btn modal-close" onClick={onClose} aria-label={t('settings.close')}>
            ×
          </button>
        </div>

        <div className="field">
          <label htmlFor="settings-locale">{t('settings.language')}</label>
          <select
            id="settings-locale"
            className="select"
            value={settings.locale}
            onChange={(event) => handleLocaleChange(event.target.value as AppLocale)}
          >
            <option value="fr">{t('welcome.french')}</option>
            <option value="en">{t('welcome.english')}</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="settings-theme">{t('settings.theme')}</label>
          <select
            id="settings-theme"
            className="select"
            value={settings.theme}
            onChange={(event) => handleThemeChange(event.target.value as ThemeMode)}
          >
            <option value="system">{t('settings.themeSystem')}</option>
            <option value="light">{t('settings.themeLight')}</option>
            <option value="dark">{t('settings.themeDark')}</option>
          </select>
        </div>
      </div>
    </div>
  )
}
