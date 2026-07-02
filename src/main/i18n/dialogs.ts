import type { AppLocale } from '@core/settings'
import { getCachedSettings } from '../settings'

type DialogLocale = AppLocale

type DialogMessages = {
  openVideoFilter: string
  exportSave: string
  exportResolveTitle: string
  exportPremiereTitle: string
  filterResolveOtio: string
  filterPremiereOtio: string
  filterResolveXml: string
  filterPremiereXml: string
}

const messages: Record<DialogLocale, DialogMessages> = {
  fr: {
    openVideoFilter: 'Vidéo',
    exportSave: 'Enregistrer',
    exportResolveTitle: 'Exporter pour DaVinci Resolve',
    exportPremiereTitle: 'Exporter pour Premiere Pro',
    filterResolveOtio: 'Timeline Resolve OTIO',
    filterPremiereOtio: 'Timeline Premiere OTIO',
    filterResolveXml: 'Timeline Resolve XML',
    filterPremiereXml: 'Timeline Premiere Pro XML'
  },
  en: {
    openVideoFilter: 'Video',
    exportSave: 'Save',
    exportResolveTitle: 'Export for DaVinci Resolve',
    exportPremiereTitle: 'Export for Premiere Pro',
    filterResolveOtio: 'Resolve OTIO timeline',
    filterPremiereOtio: 'Premiere OTIO timeline',
    filterResolveXml: 'Resolve XML timeline',
    filterPremiereXml: 'Premiere Pro XML timeline'
  }
}

export function dialogMessage<K extends keyof DialogMessages>(key: K): string {
  const locale = getCachedSettings().locale
  return messages[locale][key]
}
