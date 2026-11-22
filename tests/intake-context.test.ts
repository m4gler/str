import { describe, expect, it } from 'vitest'
import {
  buildPrivatePartnerIntakeContext,
  buildPublicPartnerIntakeContext,
  mergeTrackSelectionIntoIntakeContext,
  parseIntakeContextCookie,
  serializeIntakeContextCookie,
} from '@/lib/intakeContext'

describe('intake context', () => {
  it('round-trips a private partner invite context through the cookie serializer', () => {
    const context = buildPrivatePartnerIntakeContext({
      partnerId: 4,
      partnerSlug: 'acme',
      trackId: 9,
      trackSlug: 'space',
      privateToken: 'abc123',
    })

    expect(parseIntakeContextCookie(serializeIntakeContextCookie(context!))).toEqual({
      version: 1,
      source: 'partner_private',
      partnerId: 4,
      partnerSlug: 'acme',
      partnerLocked: true,
      trackId: 9,
      trackSlug: 'space',
      trackLocked: true,
      privateToken: 'abc123',
    })
  })

  it('merges landing track selection into a public partner context without removing the partner lock', () => {
    const context = buildPublicPartnerIntakeContext({
      id: 7,
      slug: 'founders-club',
    })

    expect(mergeTrackSelectionIntoIntakeContext(context, 'edutech')).toEqual({
      version: 1,
      source: 'partner_public',
      partnerId: 7,
      partnerSlug: 'founders-club',
      partnerLocked: true,
      trackId: null,
      trackSlug: 'edutech',
      trackLocked: false,
      privateToken: null,
    })
  })

  it('replaces a stale unlocked track context with the confirmed selection', () => {
    expect(mergeTrackSelectionIntoIntakeContext({
      version: 1,
      source: 'track',
      trackId: 9,
      trackSlug: 'space',
      trackLocked: false,
      partnerLocked: false,
    }, 'general')).toEqual({
      version: 1,
      source: 'track',
      partnerId: null,
      partnerSlug: null,
      partnerLocked: false,
      trackId: null,
      trackSlug: 'general',
      trackLocked: false,
      privateToken: null,
    })
  })

  it('keeps a private partner invite locked when a landing track click happens later', () => {
    const privateContext = buildPrivatePartnerIntakeContext({
      partnerId: 2,
      partnerSlug: 'launchpad',
      trackId: 3,
      trackSlug: 'fintech',
      privateToken: 'locked123',
    })

    expect(mergeTrackSelectionIntoIntakeContext(privateContext, 'space')).toEqual(privateContext)
  })
})
