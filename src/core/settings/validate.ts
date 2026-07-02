import {
  DEFAULT_APP_SETTINGS,
  type AppLocale,
  type AppSettings,
  type ExportNle,
  type ExportTimelineFormat,
  type ThemeMode
} from './types'

const LOCALES: AppLocale[] = ['fr', 'en']
const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark']
const EXPORT_NLES: ExportNle[] = ['resolve', 'premiere']
const EXPORT_FORMATS: ExportTimelineFormat[] = ['otio', 'xml']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function normalizeAppSettings(raw: unknown): AppSettings {
  if (!isRecord(raw)) {
    return { ...DEFAULT_APP_SETTINGS }
  }

  return {
    locale: pickEnum(raw.locale, LOCALES, DEFAULT_APP_SETTINGS.locale),
    theme: pickEnum(raw.theme, THEME_MODES, DEFAULT_APP_SETTINGS.theme),
    firstRunComplete: pickBoolean(raw.firstRunComplete, DEFAULT_APP_SETTINGS.firstRunComplete),
    exportNle: pickEnum(raw.exportNle, EXPORT_NLES, DEFAULT_APP_SETTINGS.exportNle),
    resolveExportFormat: pickEnum(
      raw.resolveExportFormat,
      EXPORT_FORMATS,
      DEFAULT_APP_SETTINGS.resolveExportFormat
    ),
    premiereExportFormat: pickEnum(
      raw.premiereExportFormat,
      EXPORT_FORMATS,
      DEFAULT_APP_SETTINGS.premiereExportFormat
    )
  }
}

export function mergeAppSettings(
  current: AppSettings,
  patch: Partial<AppSettings>
): AppSettings {
  return normalizeAppSettings({ ...current, ...patch })
}
