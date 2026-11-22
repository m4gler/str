/**
 * Integration tests for DiscountCodes collection.
 * Tests CRUD, uniqueness, usage tracking, expiry, and restrictions.
 */
import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { getTestPayload, createTestUser, cleanupUser } from './helpers'
import type { Payload } from 'payload'

let payload: Payload
const createdIds: (string | number)[] = []
const userIds: (string | number)[] = []

beforeAll(async () => {
  payload = await getTestPayload()
})

afterAll(async () => {
  for (const id of createdIds) {
    await payload.delete({ collection: 'discount-codes', id }).catch(() => {})
  }
  for (const id of userIds) await cleanupUser(payload, id)
})

describe('DiscountCodes: CRUD', () => {
  it('creates a percent discount code', async () => {
    const dc = await payload.create({
      collection: 'discount-codes',
      data: {
        code: `TEST-PCT-${Date.now()}`,
        type: 'percent',
        value: 25,
        label: 'Test 25% off',
        isActive: true,
        maxUses: 10,
      },
    }) as any
    createdIds.push(dc.id)

    expect(dc.code).toContain('TEST-PCT')
    expect(dc.type).toBe('percent')
    expect(dc.value).toBe(25)
    expect(dc.isActive).toBe(true)
    expect(dc.useCount).toBe(0)
    expect(dc.maxUses).toBe(10)
  })

  it('creates a fixed_amount discount code', async () => {
    const dc = await payload.create({
      collection: 'discount-codes',
      data: {
        code: `TEST-FIX-${Date.now()}`,
        type: 'fixed_amount',
        value: 5000,
        isActive: true,
      },
    }) as any
    createdIds.push(dc.id)

    expect(dc.type).toBe('fixed_amount')
    expect(dc.value).toBe(5000)
  })

  it('code must be unique', async () => {
    const code = `UNIQUE-DC-${Date.now()}`
    const dc1 = await payload.create({
      collection: 'discount-codes',
      data: { code, type: 'percent', value: 10 },
    }) as any
    createdIds.push(dc1.id)

    await expect(
      payload.create({
        collection: 'discount-codes',
        data: { code, type: 'percent', value: 20 },
      })
    ).rejects.toThrow()
  })
})

describe('DiscountCodes: Usage Tracking', () => {
  it('useCount starts at 0', async () => {
    const dc = await payload.create({
      collection: 'discount-codes',
      data: {
        code: `USE-TRACK-${Date.now()}`,
        type: 'percent',
        value: 10,
      },
    }) as any
    createdIds.push(dc.id)

    expect(dc.useCount).toBe(0)
    expect(dc.usedBy).toEqual([])
  })

  it('can increment useCount and add usedBy', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)

    const dc = await payload.create({
      collection: 'discount-codes',
      data: {
        code: `USE-INC-${Date.now()}`,
        type: 'percent',
        value: 15,
        maxUses: 5,
      },
    }) as any
    createdIds.push(dc.id)

    const updated = await payload.update({
      collection: 'discount-codes',
      id: dc.id,
      data: {
        useCount: 1,
        usedBy: [user.id],
      },
    }) as any

    expect(updated.useCount).toBe(1)
  })
})

describe('DiscountCodes: Expiry & Restrictions', () => {
  it('code with expiry date stores correctly', async () => {
    const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString()
    const dc = await payload.create({
      collection: 'discount-codes',
      data: {
        code: `EXPIRY-${Date.now()}`,
        type: 'percent',
        value: 30,
        expiresAt,
      },
    }) as any
    createdIds.push(dc.id)

    expect(dc.expiresAt).toBeTruthy()
  })

  it('code restricted to specific user', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)

    const dc = await payload.create({
      collection: 'discount-codes',
      data: {
        code: `RESTRICT-${Date.now()}`,
        type: 'fixed_amount',
        value: 10000,
        restrictToUser: user.id,
      },
    }) as any
    createdIds.push(dc.id)

    const fetched = await payload.findByID({
      collection: 'discount-codes',
      id: dc.id,
      depth: 0,
    }) as any
    expect(fetched.restrictToUser).toBe(user.id)
  })

  it('inactive code is stored correctly', async () => {
    const dc = await payload.create({
      collection: 'discount-codes',
      data: {
        code: `INACTIVE-${Date.now()}`,
        type: 'percent',
        value: 50,
        isActive: false,
      },
    }) as any
    createdIds.push(dc.id)

    expect(dc.isActive).toBe(false)
  })

  it('unlimited uses (maxUses=0)', async () => {
    const dc = await payload.create({
      collection: 'discount-codes',
      data: {
        code: `UNLIMITED-${Date.now()}`,
        type: 'percent',
        value: 5,
        maxUses: 0,
      },
    }) as any
    createdIds.push(dc.id)

    expect(dc.maxUses).toBe(0)
  })
})
