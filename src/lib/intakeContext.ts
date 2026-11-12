export const INTAKE_CONTEXT_COOKIE = 'intake-context'
export const INTAKE_CONTEXT_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export type IntakeContextSource = 'track' | 'partner_public' | 'partner_private'

export type IntakeContext = {
  version: 1
  source: IntakeContextSource
  partnerId?: number | null
  partnerSlug?: string | null
  partnerLocked?: boolean
  trackId?: number | null
  trackSlug?: string | null
  trackLocked?: boolean
  privateToken?: string | null
}

function normalizeSlug(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const normalized = value.trim().toLowerCase()
  return normalized || null
}

function normalizeId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function sanitizeIntakeContext(value: unknown): IntakeContext | null {
  if (!value || typeof value !== 'object') return null

  const source = (value as { source?: IntakeContextSource }).source
  if (source !== 'track' && source !== 'partner_public' && source !== 'partner_private') {
    return null
  }

  const partnerId = normalizeId((value as IntakeContext).partnerId)
  const partnerSlug = normalizeSlug((value as IntakeContext).partnerSlug)
  const trackId = normalizeId((value as IntakeContext).trackId)
  const trackSlug = normalizeSlug((value as IntakeContext).trackSlug)
  const privateToken = normalizeSlug((value as IntakeContext).privateToken)

  const partnerLocked =
    source === 'partner_public' || source === 'partner_private'
      ? true
      : Boolean((value as IntakeContext).partnerLocked)
  const trackLocked =
    source === 'partner_private'
      ? true
      : Boolean((value as IntakeContext).trackLocked)

  if ((partnerLocked || source.startsWith('partner_')) && !partnerId && !partnerSlug) {
    return null
  }

  if ((trackLocked || source === 'track' || source === 'partner_private') && !trackId && !trackSlug) {
    return null
  }

  return {
    version: 1,
    source,
    partnerId,
    partnerSlug,
    partnerLocked,
    trackId,
    trackSlug,
    trackLocked,
    privateToken,
  }
}

export function serializeIntakeContextCookie(context: IntakeContext): string {
  return encodeURIComponent(JSON.stringify(context))
}

export function parseIntakeContextCookie(value: string | null | undefined): IntakeContext | null {
  if (!value) return null

  try {
    return sanitizeIntakeContext(JSON.parse(decodeURIComponent(value)))
  } catch {
    return null
  }
}

export function getIntakeContextCookieOptions() {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: INTAKE_CONTEXT_MAX_AGE_SECONDS,
  }
}

export function buildPublicPartnerIntakeContext(partner: {
  id?: number | string | null
  slug?: string | null
}): IntakeContext | null {
  const partnerId = normalizeId(partner.id)
  const partnerSlug = normalizeSlug(partner.slug)

  if (!partnerId && !partnerSlug) return null

  return {
    version: 1,
    source: 'partner_public',
    partnerId,
    partnerSlug,
    partnerLocked: true,
    trackLocked: false,
  }
}

export function buildPrivatePartnerIntakeContext(input: {
  partnerId?: number | string | null
  partnerSlug?: string | null
  trackId?: number | string | null
  trackSlug?: string | null
  privateToken?: string | null
}): IntakeContext | null {
  const partnerId = normalizeId(input.partnerId)
  const partnerSlug = normalizeSlug(input.partnerSlug)
  const trackId = normalizeId(input.trackId)
  const trackSlug = normalizeSlug(input.trackSlug)
  const privateToken = normalizeSlug(input.privateToken)

  if ((!partnerId && !partnerSlug) || (!trackId && !trackSlug)) return null

  return {
    version: 1,
    source: 'partner_private',
    partnerId,
    partnerSlug,
    partnerLocked: true,
    trackId,
    trackSlug,
    trackLocked: true,
    privateToken,
  }
}

export function mergeTrackSelectionIntoIntakeContext(
  existingContext: IntakeContext | null,
  trackSlug: string,
): IntakeContext | null {
  const normalizedTrackSlug = normalizeSlug(trackSlug)
  if (!normalizedTrackSlug) return existingContext

  if (existingContext?.source === 'partner_private' && existingContext.trackLocked) {
    return existingContext
  }

  if (existingContext?.source === 'partner_public' || existingContext?.partnerLocked) {
    return sanitizeIntakeContext({
      ...existingContext,
      trackId: null,
      trackSlug: normalizedTrackSlug,
      trackLocked: false,
    })
  }

  return sanitizeIntakeContext({
    version: 1,
    source: 'track',
    trackId: null,
    trackSlug: normalizedTrackSlug,
    trackLocked: false,
    partnerLocked: false,
  })
}

export function getClientIntakeContext(): IntakeContext | null {
  if (typeof document === 'undefined') return null

  const cookieValue = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${INTAKE_CONTEXT_COOKIE}=`))
    ?.split('=')
    .slice(1)
    .join('=')

  return parseIntakeContextCookie(cookieValue ?? null)
}

export function setClientIntakeContext(context: IntakeContext | null): void {
  if (typeof document === 'undefined') return

  if (!context) {
    document.cookie = `${INTAKE_CONTEXT_COOKIE}=; path=/; max-age=0; samesite=lax`
    return
  }

  document.cookie = `${INTAKE_CONTEXT_COOKIE}=${serializeIntakeContextCookie(context)}; path=/; max-age=${INTAKE_CONTEXT_MAX_AGE_SECONDS}; samesite=lax`
}

export function setLandingTrackIntakeContext(trackSlug: string): void {
  const nextContext = mergeTrackSelectionIntoIntakeContext(getClientIntakeContext(), trackSlug)
  setClientIntakeContext(nextContext)
}
