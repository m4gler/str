import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { canUserReadDocument, findDocumentByDownloadLocator, getEffectiveDocumentVisibility, getRelatedId } from '@/lib/documents'

/** Allowed URL schemes for document source fetching */
const ALLOWED_SCHEMES = new Set(['http:', 'https:'])

/** Block private/internal IP ranges to prevent SSRF */
function isPrivateHost(hostname: string): boolean {
  // Block localhost variants
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return true
  // Block metadata endpoints (AWS/GCP/Azure)
  if (hostname === '169.254.169.254') return true
  // Block private IPv4 ranges
  const parts = hostname.split('.').map(Number)
  if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
    if (parts[0] === 10) return true // 10.0.0.0/8
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true // 172.16.0.0/12
    if (parts[0] === 192 && parts[1] === 168) return true // 192.168.0.0/16
    if (parts[0] === 0) return true // 0.0.0.0/8
  }
  return false
}

function buildContentDisposition(filename: string, mimeType?: string | null): string {
  const encoded = encodeURIComponent(filename)
  const disposition = mimeType?.includes('pdf') ? 'inline' : 'attachment'
  return `${disposition}; filename*=UTF-8''${encoded}`
}

function getRequestOrigin(request: Request | NextRequest): string | null {
  try {
    if ('nextUrl' in request && request.nextUrl?.origin) {
      return request.nextUrl.origin
    }

    return new URL(request.url).origin
  } catch {
    return null
  }
}

function resolveDocumentSourceUrl(rawUrl: string, request: NextRequest): URL | null {
  try {
    const origin = getRequestOrigin(request)
    if (!origin) return null
    return new URL(rawUrl, origin)
  } catch {
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const payload = await getPayload({ config })
  const { id } = await params

  const { user } = await payload.auth({ headers: request.headers }).catch(() => ({ user: null }))
  const document = await findDocumentByDownloadLocator(payload, id, 1) as any

  if (!document?.url) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  let ownerPartner = getRelatedId(document?.owner && typeof document.owner === 'object'
    ? (document.owner as any).partner
    : null)

  if (ownerPartner == null) {
    const ownerId = getRelatedId(document?.owner)
    if (ownerId != null) {
      const owner = await payload.findByID({
        collection: 'users',
        id: ownerId,
        depth: 0,
        overrideAccess: true,
      }).catch(() => null) as any
      ownerPartner = getRelatedId(owner?.partner)
    }
  }

  if (!canUserReadDocument({ ...document, ownerPartner }, user as any)) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const sourceUrl = resolveDocumentSourceUrl(document.url, request)
  if (!sourceUrl) {
    return NextResponse.json({ error: 'Document source unavailable' }, { status: 502 })
  }

  const requestOrigin = getRequestOrigin(request)
  const isSameOriginSource = Boolean(requestOrigin && sourceUrl.origin === requestOrigin)

  // SSRF protection: only allow http(s). Block private IPs only for external fetches,
  // but allow same-origin document URLs such as `/api/documents/file/...`.
  if (!ALLOWED_SCHEMES.has(sourceUrl.protocol)) {
    return NextResponse.json({ error: 'Document source unavailable' }, { status: 502 })
  }
  if (!isSameOriginSource && isPrivateHost(sourceUrl.hostname)) {
    return NextResponse.json({ error: 'Document source unavailable' }, { status: 502 })
  }

  const upstreamHeaders = new Headers()
  if (isSameOriginSource) {
    const cookie = request.headers.get('cookie')
    const range = request.headers.get('range')

    if (cookie) upstreamHeaders.set('cookie', cookie)
    if (range) upstreamHeaders.set('range', range)
  }

  const upstream = await fetch(sourceUrl.toString(), {
    cache: 'no-store',
    headers: upstreamHeaders,
  }).catch(() => null)
  if (!upstream?.ok || !upstream.body) {
    return NextResponse.json({ error: 'Document source unavailable' }, { status: 502 })
  }

  const filename = document.filename || document.title || `document-${id}`
  const headers = new Headers()
  headers.set(
    'Cache-Control',
    getEffectiveDocumentVisibility(document) === 'private'
      ? 'private, no-store, max-age=0'
      : 'public, max-age=300',
  )
  headers.set('Content-Disposition', buildContentDisposition(filename, document.mimeType))

  if (document.mimeType) {
    headers.set('Content-Type', document.mimeType)
  } else {
    const upstreamType = upstream.headers.get('content-type')
    if (upstreamType) headers.set('Content-Type', upstreamType)
  }

  if (document.filesize != null) {
    headers.set('Content-Length', String(document.filesize))
  } else {
    const upstreamLength = upstream.headers.get('content-length')
    if (upstreamLength) headers.set('Content-Length', upstreamLength)
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers,
  })
}
