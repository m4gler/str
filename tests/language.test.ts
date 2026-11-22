import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LANGUAGE,
  extractLanguageFromPathname,
  normalizeLanguage,
} from '@/lib/language'

describe('language helpers', () => {
  it('extracts supported languages from top-level locale paths', () => {
    expect(extractLanguageFromPathname('/pl')).toBe('pl')
    expect(extractLanguageFromPathname('/en/')).toBe('en')
  })

  it('ignores non-locale paths', () => {
    expect(extractLanguageFromPathname('/')).toBeNull()
    expect(extractLanguageFromPathname('/dashboard')).toBeNull()
    expect(extractLanguageFromPathname('/pl/dashboard')).toBeNull()
  })

  it('falls back to the default language for unsupported values', () => {
    expect(normalizeLanguage('de')).toBe(DEFAULT_LANGUAGE)
    expect(normalizeLanguage(null, 'pl')).toBe('pl')
  })
})
