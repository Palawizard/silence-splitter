import type { AppLocale, ThemeMode } from '@core/settings'
import { Settings, X } from 'lucide-react'
import { useI18n } from '../context/I18nProvider'
import { useSettings } from '../context/SettingsProvider'
import { outlineIconProps } from '../utils/icons'

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
        className="modal-card settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="settings-modal-title">
            <span className="section-icon" aria-hidden>
              <Settings size={17} {...outlineIconProps} />
            </span>
            <h2 id="settings-title">{t('settings.title')}</h2>
          </div>
          <button type="button" className="btn modal-close" onClick={onClose} aria-label={t('settings.close')}>
            <X size={18} {...outlineIconProps} aria-hidden />
          </button>
        </div>

        <div className="settings-fields">
        <div className="field settings-field">
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

        <div className="field settings-field">
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
    </div>
  )
}
