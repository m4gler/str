import { normalizeLanguage, type Language } from '@/lib/language'

type LegalDocumentTarget =
  | number
  | string
  | {
      id?: number | string | null
      downloadToken?: string | null
      title?: string | null
      updatedAt?: string | null
      url?: string | null
    }
  | null
  | undefined

export interface LocalizedLegalDocumentLink {
  label?: string | null
  document?: LegalDocumentTarget
  labelPl?: string | null
  documentPl?: LegalDocumentTarget
}

export interface ResolvedLegalDocumentLink {
  document: LegalDocumentTarget | null
  href: string | null
  id: string | null
  isFallback: boolean
  label: string
  lang: Language
  title: string | null
  updatedAt: string | null
}

function normalizeLabel(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

export function resolveLocalizedLegalDocument(
  link: LocalizedLegalDocumentLink | null | undefined,
  lang: string | null | undefined,
  fallbackLabel: string,
): ResolvedLegalDocumentLink {
  const resolvedLang = normalizeLanguage(lang)
  const hasPolishVariant = Boolean(link?.documentPl)
  const usePolishVariant = resolvedLang === 'pl' && hasPolishVariant
  const document = (usePolishVariant ? link?.documentPl : link?.document) ?? null
  const label = normalizeLabel(usePolishVariant ? link?.labelPl : link?.label) || fallbackLabel
  const href = typeof document === 'object' && document?.url ? document.url : null

  return {
    document,
    href,
    id: null,
    isFallback: resolvedLang === 'pl' && !usePolishVariant,
    label,
    lang: resolvedLang,
    title: typeof document === 'object' ? normalizeLabel(document?.title) : null,
    updatedAt: typeof document === 'object' && typeof document?.updatedAt === 'string' ? document.updatedAt : null,
  }
}
