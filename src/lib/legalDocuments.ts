import { getDocumentHref, getRelatedId } from '@/lib/documents'
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

function normalizeDocumentMeta(
  document: LegalDocumentTarget,
): Pick<ResolvedLegalDocumentLink, 'href' | 'id' | 'title' | 'updatedAt'> {
  if (!document) {
    return {
      href: null,
      id: null,
      title: null,
      updatedAt: null,
    }
  }

  const id = getRelatedId(document as any)
  const href = getDocumentHref(document as any)

  if (typeof document === 'object') {
    return {
      href: href && href !== '#' ? href : null,
      id: id != null ? String(id) : null,
      title: normalizeLabel(document.title),
      updatedAt: typeof document.updatedAt === 'string' ? document.updatedAt : null,
    }
  }

  return {
    href: href && href !== '#' ? href : null,
    id: id != null ? String(id) : null,
    title: null,
    updatedAt: null,
  }
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
  const meta = normalizeDocumentMeta(document)

  return {
    document,
    href: meta.href,
    id: meta.id,
    isFallback: resolvedLang === 'pl' && !usePolishVariant,
    label,
    lang: resolvedLang,
    title: meta.title,
    updatedAt: meta.updatedAt,
  }
}
