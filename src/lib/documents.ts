import type { Payload } from 'payload'

type RelatedValue = { id?: number | string | null } | number | string | null | undefined
type DocumentDownloadTarget =
  | number
  | string
  | {
      id?: number | string | null
      downloadToken?: string | null
    }

export function getRelatedId(value: RelatedValue): number | string | null {
  if (value && typeof value === 'object') {
    return value.id ?? null
  }

  return value ?? null
}

export function isLegacyUserUploadDocument(
  document:
    | {
        title?: string | null
      }
    | null
    | undefined,
): boolean {
  return typeof document?.title === 'string' && document.title.startsWith('Form upload:')
}

export function getEffectiveDocumentVisibility(
  document:
    | {
        title?: string | null
        visibility?: string | null
      }
    | null
    | undefined,
): 'public' | 'private' {
  if (document?.visibility === 'private' || isLegacyUserUploadDocument(document)) {
    return 'private'
  }

  return 'public'
}

export function getDocumentDownloadLocator(document: DocumentDownloadTarget): string | null {
  if (document != null && typeof document === 'object') {
    if (typeof document.downloadToken === 'string' && document.downloadToken.trim()) {
      return document.downloadToken.trim()
    }

    if (document.id != null) {
      return String(document.id)
    }

    return null
  }

  return String(document)
}

export function getDocumentDownloadPath(document: DocumentDownloadTarget): string {
  const locator = getDocumentDownloadLocator(document)
  return locator ? `/api/documents/${locator}/download` : '#'
}

export function getDocumentLocatorFromDownloadPath(value: string): string | null {
  const raw = value.trim()
  if (!raw) return null

  let pathname = raw
  try {
    pathname = new URL(raw).pathname
  } catch {
    pathname = raw
  }

  const match = pathname.match(/^\/api\/documents\/([^/]+)\/download\/?$/)
  return match?.[1] ?? null
}

export const getDocumentIdFromDownloadPath = getDocumentLocatorFromDownloadPath

export function isDocumentDownloadPath(value: string): boolean {
  return getDocumentLocatorFromDownloadPath(value) !== null
}

export async function findDocumentByDownloadLocator(
  payload: Payload,
  locator: string,
  depth = 0,
): Promise<Record<string, unknown> | null> {
  const byToken = await payload.find({
    collection: 'documents',
    where: {
      downloadToken: { equals: locator },
    },
    limit: 1,
    depth,
    overrideAccess: true,
  }).catch(() => null)

  if (byToken?.docs?.[0]) {
    return byToken.docs[0] as unknown as Record<string, unknown>
  }

  if (/^\d+$/.test(locator)) {
    return await payload.findByID({
      collection: 'documents',
      id: locator,
      depth,
      overrideAccess: true,
    }).catch(() => null) as unknown as Record<string, unknown> | null
  }

  return null
}

export function getDocumentHref(
  document:
    | {
        id?: number | string | null
        downloadToken?: string | null
        url?: string | null
      }
    | null
    | undefined,
): string {
  if (!document) return '#'

  const downloadPath = getDocumentDownloadPath(document)
  if (downloadPath !== '#') {
    return downloadPath
  }

  return document.url || '#'
}

export function canUserReadDocument(
  document: {
    owner?: RelatedValue
    ownerPartner?: RelatedValue
    visibility?: string | null
  } | null | undefined,
  user?: {
    id?: number | string | null
    role?: string | null
    partner?: RelatedValue
  } | null,
): boolean {
  const visibility = getEffectiveDocumentVisibility(document)

  if (visibility !== 'private') {
    return true
  }

  if (!user?.id) {
    return false
  }

  if (user.role === 'admin') {
    return true
  }

  const ownerId = getRelatedId(document?.owner)
  if (String(ownerId) === String(user.id)) {
    return true
  }

  if (user.role === 'mentor') {
    const mentorPartnerId = getRelatedId(user.partner)
    if (mentorPartnerId == null) {
      return true
    }

    return String(getRelatedId(document?.ownerPartner)) === String(mentorPartnerId)
  }

  if (user.role === 'partner') {
    const partnerId = getRelatedId(user.partner)
    return partnerId != null && String(getRelatedId(document?.ownerPartner)) === String(partnerId)
  }

  return false
}
