import { describe, expect, it } from 'vitest'
import { getTrackPartnerTiles, normalizeLandingPartner } from '@/lib/landingTracks'

describe('landing track partners', () => {
  it('keeps placeholder partners visible even without a logo', () => {
    const partner = normalizeLandingPartner({
      id: 1,
      name: 'Space Scavengers',
      websiteUrl: 'spacescavengers.sk',
      logo: null,
    })

    expect(partner).toEqual({
      id: 1,
      name: 'Space Scavengers',
      websiteUrl: 'https://spacescavengers.sk',
      logoUrl: null,
    })

    expect(getTrackPartnerTiles([partner!])).toHaveLength(1)
  })

  it('returns only explicitly configured track partners', () => {
    const trackPartners = [
      normalizeLandingPartner({ id: 1, name: 'Technischools', websiteUrl: 'technischools.example' }),
    ].filter(Boolean)

    const landingPartners = [
      normalizeLandingPartner({ id: 2, name: 'Copernic Space', websiteUrl: 'copernic.example' }),
      normalizeLandingPartner({ id: 3, name: 'Amber Hill Studio', websiteUrl: 'amber.example' }),
    ].filter(Boolean)

    expect(getTrackPartnerTiles(trackPartners as any[]).map((partner) => partner.name)).toEqual(['Technischools'])
    expect(getTrackPartnerTiles(landingPartners as any[]).map((partner) => partner.name)).toEqual([
      'Copernic Space',
      'Amber Hill Studio',
    ])
  })
})

