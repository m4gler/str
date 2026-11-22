/**
 * Integration tests for Partners and Cohorts collections.
 * Tests CRUD, partner features, cohort configuration, and relationships.
 */
import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { getTestPayload } from './helpers'
import type { Payload } from 'payload'

let payload: Payload
const partnerIds: (string | number)[] = []
const cohortIds: (string | number)[] = []

beforeAll(async () => {
  payload = await getTestPayload()
})

afterAll(async () => {
  for (const id of cohortIds) {
    await payload.delete({ collection: 'cohorts', id }).catch(() => {})
  }
  for (const id of partnerIds) {
    await payload.delete({ collection: 'partners', id }).catch(() => {})
  }
})

describe('Partners: CRUD', () => {
  it('creates a partner with basic fields', async () => {
    const p = await payload.create({
      collection: 'partners',
      data: {
        name: 'Test Partner',
        slug: `test-partner-${Date.now()}`,
        description: 'A test partner for integration tests',
        isActive: true,
      },
    }) as any
    partnerIds.push(p.id)

    expect(p.name).toBe('Test Partner')
    expect(p.slug).toContain('test-partner')
    expect(p.isActive).toBe(true)
  })

  it('partner slug must be unique', async () => {
    const slug = `unique-slug-${Date.now()}`
    const p1 = await payload.create({
      collection: 'partners',
      data: { name: 'First Partner', slug },
    }) as any
    partnerIds.push(p1.id)

    await expect(
      payload.create({
        collection: 'partners',
        data: { name: 'Duplicate Slug', slug },
      })
    ).rejects.toThrow()
  })

  it('partner with custom pricing (free)', async () => {
    const p = await payload.create({
      collection: 'partners',
      data: {
        name: 'Free Partner',
        slug: `free-partner-${Date.now()}`,
        customPricing: {
          enabled: true,
          type: 'free',
        },
      },
    }) as any
    partnerIds.push(p.id)

    expect(p.customPricing.enabled).toBe(true)
    expect(p.customPricing.type).toBe('free')
  })

  it('partner with custom pricing (fixed)', async () => {
    const p = await payload.create({
      collection: 'partners',
      data: {
        name: 'Fixed Price Partner',
        slug: `fixed-partner-${Date.now()}`,
        customPricing: {
          enabled: true,
          type: 'fixed',
          amountGroszy: 15000,
        },
      },
    }) as any
    partnerIds.push(p.id)

    expect(p.customPricing.type).toBe('fixed')
    expect(p.customPricing.amountGroszy).toBe(15000)
  })

  it('partner with banned words', async () => {
    const p = await payload.create({
      collection: 'partners',
      data: {
        name: 'Strict Partner',
        slug: `strict-partner-${Date.now()}`,
        bannedWords: 'gambling, casino, mlm',
      },
    }) as any
    partnerIds.push(p.id)

    expect(p.bannedWords).toContain('gambling')
  })

  it('partner with location data', async () => {
    const p = await payload.create({
      collection: 'partners',
      data: {
        name: 'Warsaw Partner',
        slug: `warsaw-partner-${Date.now()}`,
        location: {
          city: 'Warsaw',
          country: 'Poland',
          lat: 52.2297,
          lng: 21.0122,
        },
      },
    }) as any
    partnerIds.push(p.id)

    expect(p.location.city).toBe('Warsaw')
    expect(p.location.country).toBe('Poland')
    expect(p.location.lat).toBeCloseTo(52.2297, 2)
  })

  it('partner override grants tracking', async () => {
    const p = await payload.create({
      collection: 'partners',
      data: {
        name: 'Override Partner',
        slug: `override-partner-${Date.now()}`,
        overrideGrantsRemaining: 5,
      },
    }) as any
    partnerIds.push(p.id)

    expect(p.overrideGrantsRemaining).toBe(5)

    const updated = await payload.update({
      collection: 'partners',
      id: p.id,
      data: { overrideGrantsRemaining: 4 },
    }) as any
    expect(updated.overrideGrantsRemaining).toBe(4)
  })
})

describe('Cohorts: CRUD', () => {
  it('creates a cohort with defaults', async () => {
    const c = await payload.create({
      collection: 'cohorts',
      data: {
        name: 'Test Cohort Spring 2026',
        slug: `test-cohort-${Date.now()}`,
        timezone: 'Europe/Warsaw',
        isActive: true,
      },
    }) as any
    cohortIds.push(c.id)

    expect(c.name).toBe('Test Cohort Spring 2026')
    expect(c.timezone).toBe('Europe/Warsaw')
    expect(c.isActive).toBe(true)
  })

  it('cohort slug must be unique', async () => {
    const slug = `unique-cohort-${Date.now()}`
    const c1 = await payload.create({
      collection: 'cohorts',
      data: { name: 'First Cohort', slug, timezone: 'Europe/Warsaw' },
    }) as any
    cohortIds.push(c1.id)

    await expect(
      payload.create({
        collection: 'cohorts',
        data: { name: 'Dup Cohort', slug, timezone: 'UTC' },
      })
    ).rejects.toThrow()
  })

  it('cohort with partner relationship', async () => {
    const partner = await payload.create({
      collection: 'partners',
      data: {
        name: 'Cohort Partner',
        slug: `cohort-partner-${Date.now()}`,
      },
    }) as any
    partnerIds.push(partner.id)

    const c = await payload.create({
      collection: 'cohorts',
      data: {
        name: 'Partner Cohort',
        slug: `partner-cohort-${Date.now()}`,
        timezone: 'Europe/Berlin',
        partner: partner.id,
      },
    }) as any
    cohortIds.push(c.id)

    const fetched = await payload.findByID({
      collection: 'cohorts',
      id: c.id,
      depth: 0,
    }) as any
    expect(fetched.partner).toBe(partner.id)
  })

  it('cohort with dates and max members', async () => {
    const c = await payload.create({
      collection: 'cohorts',
      data: {
        name: 'Full Config Cohort',
        slug: `full-cohort-${Date.now()}`,
        timezone: 'America/New_York',
        startDate: '2026-04-01T00:00:00.000Z',
        preworkStartDate: '2026-03-15T00:00:00.000Z',
        maxMembers: 50,
        description: 'A fully configured test cohort',
      },
    }) as any
    cohortIds.push(c.id)

    expect(c.maxMembers).toBe(50)
    expect(c.timezone).toBe('America/New_York')
    expect(c.startDate).toBeTruthy()
    expect(c.preworkStartDate).toBeTruthy()
  })

  it('cohort with different timezones', async () => {
    const timezones = ['Europe/Warsaw', 'UTC', 'America/New_York', 'Asia/Tokyo']
    for (const tz of timezones) {
      const c = await payload.create({
        collection: 'cohorts',
        data: {
          name: `TZ ${tz}`,
          slug: `tz-${tz.replace('/', '-').toLowerCase()}-${Date.now()}`,
          timezone: tz,
        },
      }) as any
      cohortIds.push(c.id)
      expect(c.timezone).toBe(tz)
    }
  })
})
