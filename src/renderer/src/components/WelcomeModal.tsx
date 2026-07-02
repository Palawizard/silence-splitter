import { useState } from 'react'
import type { AppLocale } from '@core/settings'
import { translate } from '../i18n'
import { useSettings } from '../context/SettingsProvider'

type WelcomeModalProps = {
  onComplete: () => void
}

export default function WelcomeModal({ onComplete }: WelcomeModalProps) {
  const { updateSettings } = useSettings()
  const [selectedLocale, setSelectedLocale] = useState<AppLocale>('fr')
  const [isSaving, setIsSaving] = useState(false)

  const t = (key: string) => translate(selectedLocale, key)

  async function handleContinue() {
    setIsSaving(true)
    try {
      await updateSettings({
        locale: selectedLocale,
        firstRunComplete: true
      })
      onComplete()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-overlay" role="presentation">
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <h2 id="welcome-title">{t('welcome.title')}</h2>
        <p className="modal-subtitle">{t('welcome.subtitle')}</p>

        <div className="welcome-locale-options">
          <label className={`welcome-locale-option${selectedLocale === 'fr' ? ' is-selected' : ''}`}>
            <input
              type="radio"
              name="welcome-locale"
              value="fr"
              checked={selectedLocale === 'fr'}
              onChange={() => setSelectedLocale('fr')}
            />
            <span>{t('welcome.french')}</span>
          </label>
          <label className={`welcome-locale-option${selectedLocale === 'en' ? ' is-selected' : ''}`}>
            <input
              type="radio"
              name="welcome-locale"
              value="en"
              checked={selectedLocale === 'en'}
              onChange={() => setSelectedLocale('en')}
            />
            <span>{t('welcome.english')}</span>
          </label>
        </div>

        <button
          type="button"
          className="btn btn-primary modal-primary-action"
          onClick={() => void handleContinue()}
          disabled={isSaving}
        >
          {t('welcome.continue')}
        </button>
      </div>
    </div>
  )
}
