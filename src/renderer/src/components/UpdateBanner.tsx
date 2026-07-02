import { useEffect, useState } from 'react'
import type { UpdateStatus } from '../../../preload/index'
import { useI18n } from '../context/I18nProvider'

export default function UpdateBanner() {
  const { t } = useI18n()
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })

  useEffect(() => {
    void window.api.getUpdateStatus().then(setStatus)
    return window.api.onUpdateStatus(setStatus)
  }, [])

  if (status.state === 'idle' || status.state === 'not-available' || status.state === 'error') {
    return null
  }

  let message = t('update.checking')
  if (status.state === 'available') {
    message = t('update.available', { version: status.version })
  } else if (status.state === 'downloading') {
    message = t('update.downloading', { percent: status.percent })
  } else if (status.state === 'downloaded') {
    message = t('update.downloaded', { version: status.version })
  }

  return (
    <div className="banner update-banner" role="status">
      <span>{message}</span>
      {status.state === 'available' && (
        <button className="btn btn-primary" type="button" onClick={() => void window.api.downloadUpdate()}>
          {t('update.download')}
        </button>
      )}
      {status.state === 'downloaded' && (
        <button className="btn btn-primary" type="button" onClick={() => window.api.installUpdate()}>
          {t('update.restart')}
        </button>
      )}
    </div>
  )
}
