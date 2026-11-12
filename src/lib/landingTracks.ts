export interface LandingPartner {
  id: string | number
  name: string
  websiteUrl: string | null
  logoUrl: string | null
}

function normalizeWebsiteUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

export function normalizeLandingPartner(partner: any): LandingPartner | null {
  if (!partner || typeof partner !== 'object') return null

  const rawName = typeof partner.name === 'string' ? partner.name.trim() : ''
  if (!rawName) return null

  return {
    id: partner.id ?? rawName,
    name: rawName,
    websiteUrl: normalizeWebsiteUrl(partner.websiteUrl),
    logoUrl:
      partner.logo && typeof partner.logo === 'object'
        ? partner.logo?.url ?? null
        : null,
  }
}

export function getTrackPartnerTiles(partners: LandingPartner[]) {
  return partners.filter((partner) => partner.name.trim().length > 0)
}

