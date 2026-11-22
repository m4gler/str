/**
 * Integration tests for the full 100-day program flow.
 * Tests: program start, prework, daily submissions, day progression,
 *        miss detection, attempt lifecycle, and completion.
 */
import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import {
  getTestPayload,
  createTestUser,
  createTestForm,
  createTestAttempt,
  submitForm,
  cleanupUser,
  cleanupForm,
} from './helpers'
import { checkAndProcessMisses } from '@/lib/missCheck'
import type { Payload } from 'payload'

let payload: Payload
let dayForm: any
const userIds: (string | number)[] = []

beforeAll(async () => {
  payload = await getTestPayload()
  dayForm = await createTestForm(payload, { slug: `test-daily-form-${Date.now()}` })
})

afterAll(async () => {
  for (const id of userIds) await cleanupUser(payload, id)
  await cleanupForm(payload, dayForm.id)
})

// ── Program Initialization ──

describe('Program: Start & Attempt Creation', () => {
  it('creates an attempt with correct defaults', async () => {
    const { user } = await createTestUser(payload, {
      programStatus: 'active',
      hasPaid100Days: true,
      programStartDate: new Date().toISOString(),
    })
    userIds.push(user.id)

    const attempt = await createTestAttempt(payload, user.id)

    expect(attempt.status).toBe('active')
    expect(attempt.missCount).toBe(0)
    expect(attempt.missedDays).toEqual([])
    expect(attempt.attemptNumber).toBe(1)
    expect(attempt.paymentType).toBe('self_paid')
  })

  it('user programStatus tracks attempt state', async () => {
    const { user } = await createTestUser(payload, { programStatus: 'prework' })
    userIds.push(user.id)

    expect(user.programStatus).toBe('prework')

    const updated = await payload.update({
      collection: 'users',
      id: user.id,
      data: { programStatus: 'active', programStartDate: new Date().toISOString() },
    })

    expect((updated as any).programStatus).toBe('active')
  })

  it('programAttempts increments correctly', async () => {
    const { user } = await createTestUser(payload, { programAttempts: 0 })
    userIds.push(user.id)

    const updated = await payload.update({
      collection: 'users',
      id: user.id,
      data: { programAttempts: 1 },
    })

    expect((updated as any).programAttempts).toBe(1)
  })
})

// ── Daily Submissions ──

describe('Program: Daily Submissions', () => {
  it('day 1 submission with programDay=1', async () => {
    const { user } = await createTestUser(payload, {
      programStatus: 'active',
      programStartDate: new Date().toISOString(),
    })
    userIds.push(user.id)
    const attempt = await createTestAttempt(payload, user.id)

    const sub = await submitForm(payload, user.id, dayForm.id, {
      programDay: 1,
      dayType: 'standard',
      attempt: attempt.id,
    })

    expect(sub.programDay).toBe(1)
    expect(sub.dayType).toBe('standard')
    const attemptRef = typeof sub.attempt === 'object' ? sub.attempt.id : sub.attempt
    expect(attemptRef).toBe(attempt.id)
  })

  it('submitting multiple days in sequence', async () => {
    const { user } = await createTestUser(payload, {
      programStatus: 'active',
      programStartDate: new Date(Date.now() - 5 * 86400000).toISOString(),
    })
    userIds.push(user.id)
    const attempt = await createTestAttempt(payload, user.id)

    for (let day = 1; day <= 5; day++) {
      await submitForm(payload, user.id, dayForm.id, {
        programDay: day,
        dayType: 'standard',
        attempt: attempt.id,
      })
    }

    const subs = await payload.find({
      collection: 'founder-form-submissions',
      where: { user: { equals: user.id }, programDay: { exists: true } },
      sort: 'programDay',
    })

    expect(subs.totalDocs).toBe(5)
    const days = subs.docs.map((s: any) => s.programDay)
    expect(days).toEqual([1, 2, 3, 4, 5])
  })

  it('gate day submission (day 15)', async () => {
    const { user } = await createTestUser(payload, {
      programStatus: 'active',
      programStartDate: new Date(Date.now() - 16 * 86400000).toISOString(),
    })
    userIds.push(user.id)
    const attempt = await createTestAttempt(payload, user.id)

    const sub = await submitForm(payload, user.id, dayForm.id, {
      programDay: 15,
      dayType: 'gate',
      attempt: attempt.id,
    })

    expect(sub.dayType).toBe('gate')
    expect(sub.programDay).toBe(15)
  })

  it('retro day submission (day 7)', async () => {
    const { user } = await createTestUser(payload, {
      programStatus: 'active',
      programStartDate: new Date(Date.now() - 8 * 86400000).toISOString(),
    })
    userIds.push(user.id)
    const attempt = await createTestAttempt(payload, user.id)

    const sub = await submitForm(payload, user.id, dayForm.id, {
      programDay: 7,
      dayType: 'retro',
      attempt: attempt.id,
    })

    expect(sub.dayType).toBe('retro')
  })
})

// ── Miss Detection ──

describe('Program: Miss Detection', () => {
  it('detects single missed day and transitions to warned_1', async () => {
    // User started 3 days ago, submitted day 1 only, now day 3
    const startDate = new Date(Date.now() - 3 * 86400000)
    const { user } = await createTestUser(payload, {
      programStatus: 'active',
      programStartDate: startDate.toISOString(),
    })
    userIds.push(user.id)

    const attempt = await createTestAttempt(payload, user.id, {
      startedAt: startDate.toISOString(),
    })

    // Submit day 1 only — day 2 is missed
    await submitForm(payload, user.id, dayForm.id, {
      programDay: 1,
      attempt: attempt.id,
    })

    const result = await checkAndProcessMisses(payload, attempt.id)

    expect(result.processed).toBe(true)
    expect(result.missesDetected).toBeGreaterThanOrEqual(1)

    // Re-fetch attempt
    const updated = await payload.findByID({ collection: 'attempts', id: attempt.id }) as any
    expect(['warned_1', 'warned_2', 'failed']).toContain(updated.status)
    expect(updated.missCount).toBeGreaterThanOrEqual(1)
    expect(updated.missedDays.length).toBeGreaterThanOrEqual(1)
  })

  it('3 misses → attempt failed', async () => {
    // User started 5 days ago, submitted nothing
    const startDate = new Date(Date.now() - 5 * 86400000)
    const { user } = await createTestUser(payload, {
      programStatus: 'active',
      programStartDate: startDate.toISOString(),
    })
    userIds.push(user.id)

    const attempt = await createTestAttempt(payload, user.id, {
      startedAt: startDate.toISOString(),
    })

    const result = await checkAndProcessMisses(payload, attempt.id)

    expect(result.failed).toBe(true)

    const updated = await payload.findByID({ collection: 'attempts', id: attempt.id }) as any
    expect(updated.status).toBe('failed')
    expect(updated.missCount).toBe(3)
    expect(updated.endedAt).toBeTruthy()
  })

  it('miss check is idempotent (no double-counting)', async () => {
    const startDate = new Date(Date.now() - 3 * 86400000)
    const { user } = await createTestUser(payload, {
      programStatus: 'active',
      programStartDate: startDate.toISOString(),
    })
    userIds.push(user.id)

    const attempt = await createTestAttempt(payload, user.id, {
      startedAt: startDate.toISOString(),
    })

    // Submit day 1
    await submitForm(payload, user.id, dayForm.id, {
      programDay: 1,
      attempt: attempt.id,
    })

    // Run miss check twice
    const r1 = await checkAndProcessMisses(payload, attempt.id)
    const r2 = await checkAndProcessMisses(payload, attempt.id)

    // Second run should not detect new misses
    expect(r2.missesDetected).toBe(0)

    const final = await payload.findByID({ collection: 'attempts', id: attempt.id }) as any
    expect(final.missCount).toBe(r1.missesDetected)
  })

  it('prework users are exempt from miss counting', async () => {
    const { user } = await createTestUser(payload, {
      programStatus: 'prework',
    })
    userIds.push(user.id)

    const attempt = await createTestAttempt(payload, user.id)

    const result = await checkAndProcessMisses(payload, attempt.id)
    expect(result.processed).toBe(true)
    expect(result.missesDetected).toBe(0)
  })

  it('already-failed attempts are skipped', async () => {
    const { user } = await createTestUser(payload, {
      programStatus: 'failed',
      programStartDate: new Date(Date.now() - 10 * 86400000).toISOString(),
    })
    userIds.push(user.id)

    const attempt = await createTestAttempt(payload, user.id, {
      status: 'failed',
      missCount: 3,
      endedAt: new Date().toISOString(),
    })

    const result = await checkAndProcessMisses(payload, attempt.id)
    expect(result.processed).toBe(true)
    expect(result.missesDetected).toBe(0)
    expect(result.newStatus).toBe('failed')
  })

  it('no miss detected when all days are submitted', async () => {
    const startDate = new Date(Date.now() - 3 * 86400000)
    const { user } = await createTestUser(payload, {
      programStatus: 'active',
      programStartDate: startDate.toISOString(),
    })
    userIds.push(user.id)

    const attempt = await createTestAttempt(payload, user.id, {
      startedAt: startDate.toISOString(),
    })

    // User started 3 calendar days ago, so days 1..3 should already exist.
    for (let d = 1; d <= 3; d++) {
      await submitForm(payload, user.id, dayForm.id, {
        programDay: d,
        attempt: attempt.id,
      })
    }

    const result = await checkAndProcessMisses(payload, attempt.id)
    expect(result.missesDetected).toBe(0)
  })
})

// ── Attempt Lifecycle ──

describe('Program: Attempt Lifecycle', () => {
  it('multiple attempts for same user', async () => {
    const { user } = await createTestUser(payload, {
      programStatus: 'active',
      programAttempts: 2,
    })
    userIds.push(user.id)

    const a1 = await createTestAttempt(payload, user.id, {
      attemptNumber: 1,
      status: 'failed',
      endedAt: new Date().toISOString(),
    })
    const a2 = await createTestAttempt(payload, user.id, {
      attemptNumber: 2,
      status: 'active',
    })

    const attempts = await payload.find({
      collection: 'attempts',
      where: { user: { equals: user.id } },
      sort: 'attemptNumber',
    })

    expect(attempts.totalDocs).toBe(2)
    expect((attempts.docs[0] as any).status).toBe('failed')
    expect((attempts.docs[1] as any).status).toBe('active')
  })

  it('attempt payment types are stored correctly', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)

    const types = ['self_paid', 'paid', 'free', 'test', 'sponsored', 'partnership'] as const
    for (const pt of types) {
      const a = await createTestAttempt(payload, user.id, {
        paymentType: pt,
        attemptNumber: types.indexOf(pt) + 1,
      })
      expect(a.paymentType).toBe(pt)
    }
  })
})
