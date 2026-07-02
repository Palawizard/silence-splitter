import { Check, Download } from 'lucide-react'
import { useI18n } from '../context/I18nProvider'
import { outlineIconProps } from '../utils/icons'

export type TimelineExportNle = 'resolve' | 'premiere'
export type TimelineExportFormat = 'otio' | 'xml'

type ExportPanelProps = {
  nle: TimelineExportNle
  resolveFormat: TimelineExportFormat
  premiereFormat: TimelineExportFormat
  state: 'idle' | 'exporting' | 'success'
  exportedPath: string | null
  exportedAudioDirectory: string | null
  onNleChange: (nle: TimelineExportNle) => void
  onResolveFormatChange: (format: TimelineExportFormat) => void
  onPremiereFormatChange: (format: TimelineExportFormat) => void
  onExport: () => void
}

export default function ExportPanel(props: ExportPanelProps) {
  const { t } = useI18n()
  const {
    nle, resolveFormat, premiereFormat, state, exportedPath, exportedAudioDirectory,
    onNleChange, onResolveFormatChange, onPremiereFormatChange, onExport
  } = props
  const isExporting = state === 'exporting'
  const buttonLabel = isExporting
    ? t('export.inProgress')
    : nle === 'resolve' ? t('export.buttonResolve') : t('export.buttonPremiere')
  const successLabel = nle === 'resolve' ? t('export.successResolve') : t('export.successPremiere')

  return (
    <section className="card">
      <div className="export-layout">
        <div className="export-intro">
          <div className="section-heading">
            <span className="section-icon" aria-hidden><Download size={17} {...outlineIconProps} /></span>
            <h2>{t('export.title')}</h2>
          </div>
          <p className="hint">{t('export.hint')}</p>
        </div>
        <div className="export-controls">
          <div className="field compact-field">
            <label htmlFor="export-nle">{t('export.nle')}</label>
            <select id="export-nle" className="select" value={nle} onChange={(event) => onNleChange(event.target.value as TimelineExportNle)} disabled={isExporting}>
              <option value="resolve">{t('export.resolve')}</option>
              <option value="premiere">{t('export.premiere')}</option>
            </select>
          </div>
          {nle === 'resolve' && (
            <div className="field compact-field">
              <label htmlFor="resolve-format">{t('export.resolveFormat')}</label>
              <select id="resolve-format" className="select" value={resolveFormat} onChange={(event) => onResolveFormatChange(event.target.value as TimelineExportFormat)} disabled={isExporting}>
                <option value="otio">{t('export.otioResolve')}</option>
                <option value="xml">{t('export.xmlResolve')}</option>
              </select>
            </div>
          )}
          {nle === 'premiere' && (
            <div className="field compact-field">
              <label htmlFor="premiere-format">{t('export.premiereFormat')}</label>
              <select id="premiere-format" className="select" value={premiereFormat} onChange={(event) => onPremiereFormatChange(event.target.value as TimelineExportFormat)} disabled={isExporting}>
                <option value="otio">{t('export.otioPremiere')}</option>
                <option value="xml">{t('export.xmlPremiere')}</option>
              </select>
            </div>
          )}
          <button type="button" className="btn btn-primary" onClick={onExport} disabled={isExporting}>
            <Download size={17} {...outlineIconProps} aria-hidden />
            {buttonLabel}
          </button>
        </div>
      </div>
      {state === 'success' && exportedPath && (
        <p className="export-success" role="status">
          <Check size={16} {...outlineIconProps} aria-hidden />
          <span className="export-success-copy">
            {successLabel} : <span>{exportedPath}</span>
            {exportedAudioDirectory && <><br />{t('export.audioTracks')} : <span>{exportedAudioDirectory}</span></>}
          </span>
        </p>
      )}
    </section>
  )
}
