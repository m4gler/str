import { describe, expect, it } from 'vitest'
import { resolveLocalizedLegalDocument } from '@/lib/legalDocuments'

describe('resolveLocalizedLegalDocument', () => {
  it('returns the Polish variant when available', () => {
    const resolved = resolveLocalizedLegalDocument(
      {
        label: 'Terms of Use',
        document: { id: 10, title: 'Terms EN', updatedAt: '2026-04-10T10:00:00.000Z' },
        labelPl: 'Regulamin',
        documentPl: { id: 11, title: 'Regulamin', updatedAt: '2026-04-11T10:00:00.000Z' },
      },
      'pl',
      'Fallback',
    )

    expect(resolved.lang).toBe('pl')
    expect(resolved.isFallback).toBe(false)
    expect(resolved.label).toBe('Regulamin')
    expect(resolved.id).toBe('11')
    expect(resolved.title).toBe('Regulamin')
    expect(resolved.href).toBe('/api/documents/11/download')
  })

  it('falls back to the default document when a Polish variant is missing', () => {
    const resolved = resolveLocalizedLegalDocument(
      {
        label: 'Privacy Policy',
        document: { id: 21, title: 'Privacy', updatedAt: '2026-04-09T09:00:00.000Z' },
      },
      'pl',
      'Fallback',
    )

    expect(resolved.lang).toBe('pl')
    expect(resolved.isFallback).toBe(true)
    expect(resolved.label).toBe('Privacy Policy')
    expect(resolved.id).toBe('21')
    expect(resolved.href).toBe('/api/documents/21/download')
  })
})
