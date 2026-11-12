export const LANGUAGE_STORAGE_KEY = 'mesga-lang'
export const LANGUAGE_COOKIE_KEY = 'mesga-lang'
export const LANGUAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365
export const DEFAULT_LANGUAGE = 'en'
export const SUPPORTED_LANGUAGES = ['en', 'pl'] as const

export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export function isLanguage(value: string | null | undefined): value is Language {
  return value === 'en' || value === 'pl'
}

export function normalizeLanguage(
  value: string | null | undefined,
  fallback: Language = DEFAULT_LANGUAGE,
): Language {
  return isLanguage(value) ? value : fallback
}

export function extractLanguageFromPathname(pathname: string): Language | null {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/'

  if (normalizedPath === '/en') {
    return 'en'
  }

  if (normalizedPath === '/pl') {
    return 'pl'
  }

  return null
}
