export type AppLocale = 'fr' | 'en'

export type ThemeMode = 'system' | 'light' | 'dark'

export type ExportNle = 'resolve' | 'premiere'

export type ExportTimelineFormat = 'otio' | 'xml'

export type AppSettings = {
  locale: AppLocale
  theme: ThemeMode
  firstRunComplete: boolean
  exportNle: ExportNle
  resolveExportFormat: ExportTimelineFormat
  premiereExportFormat: ExportTimelineFormat
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  locale: 'fr',
  theme: 'system',
  firstRunComplete: false,
  exportNle: 'resolve',
  resolveExportFormat: 'otio',
  premiereExportFormat: 'otio'
}
