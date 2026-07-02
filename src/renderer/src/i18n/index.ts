import type { AppLocale } from '@core/settings'
import en from './en.json'
import fr from './fr.json'

type MessageCatalog = typeof fr

const catalogs: Record<AppLocale, MessageCatalog> = {
  fr,
  en
}

export type TranslateVars = Record<string, string | number>

function resolveMessage(catalog: MessageCatalog, key: string): string | undefined {
  const parts = key.split('.')
  let node: unknown = catalog

  for (const part of parts) {
    if (typeof node !== 'object' || node === null || !(part in node)) {
      return undefined
    }
    node = (node as Record<string, unknown>)[part]
  }

  return typeof node === 'string' ? node : undefined
}

function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) {
    return template
  }

  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = vars[name]
    return value === undefined ? `{${name}}` : String(value)
  })
}

export function translate(locale: AppLocale, key: string, vars?: TranslateVars): string {
  const primary = resolveMessage(catalogs[locale], key)
  const fallback = resolveMessage(catalogs.fr, key)
  const template = primary ?? fallback ?? key
  return interpolate(template, vars)
}

export function translatePlural(
  locale: AppLocale,
  key: string,
  count: number,
  vars?: TranslateVars
): string {
  const pluralKey = count === 1 ? 'one' : 'other'
  return translate(locale, `${key}.${pluralKey}`, { count, ...vars })
}

export function applyDocumentLocale(locale: AppLocale): void {
  document.documentElement.lang = locale
}

export function getPresetLabel(locale: AppLocale, presetId: string): string {
  return translate(locale, `presets.${presetId}`)
}
