/**
 * End-to-end integration test for the full 100-day program journey.
 * Tests: register → profile → payment activation → prework → daily submission →
 *        miss detection → gate review → attempt lifecycle → completion.
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
  dayForm = await createTestForm(payload, { slug: `journey-form-${Date.now()}` })
})

afterAll(async () => {
  for (const id of userIds) await cleanupUser(payload, id)
  await cleanupForm(payload, dayForm.id)
})

describe('Full Journey: Happy Path', () => {
  it('founder completes full registration → activation → daily flow', async () => {
    // 1. Register founder
    const { user, email, password } = await createTestUser(payload, {
      role: 'founder',
      programStatus: 'prework',
      businessIdea: 'Space farming on Mars',
    })
    userIds.push(user.id)

    expect(user.role).toBe('founder')
    expect(user.isOnboarded).toBe(true)

    // 2. Login
    const loginResult = await payload.login({
      collection: 'users',
      data: { email, password },
    })
    expect(loginResult.token).toBeTruthy()

    // 3. Simulate payment activation
    const activated = await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        hasPaid100Days: true,
        programStatus: 'active',
        programStartDate: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
    }) as any
    expect(activated.hasPaid100Days).toBe(true)
    expect(activated.programStatus).toBe('active')

    // 4. Create attempt
    const attempt = await createTestAttempt(payload, user.id, {
      startedAt: activated.programStartDate,
    })
    expect(attempt.status).toBe('active')
    expect(attempt.missCount).toBe(0)

    // 5. Submit Day 1 and Day 2
    const sub1 = await submitForm(payload, user.id, dayForm.id, {
      programDay: 1,
      dayType: 'standard',
      attempt: attempt.id,
    })
    expect(sub1.programDay).toBe(1)

    const sub2 = await submitForm(payload, user.id, dayForm.id, {
      programDay: 2,
      dayType: 'standard',
      attempt: attempt.id,
    })
    expect(sub2.programDay).toBe(2)

    // 6. Verify no misses
    const missResult = await checkAndProcessMisses(payload, attempt.id)
    expect(missResult.missesDetected).toBe(0)

    // 7. Verify submissions are tracked
    const allSubs = await payload.find({
      collection: 'founder-form-submissions',
      where: {
        user: { equals: user.id },
        programDay: { exists: true },
      },
      sort: 'programDay',
    })
    expect(allSubs.totalDocs).toBe(2)
  })
})

describe('Full Journey: Miss → Warn → Fail', () => {
  it('founder misses 3 days and fails attempt', async () => {
    // Start 6 days ago, submit nothing
    const startDate = new Date(Date.now() - 6 * 86400000)
    const { user } = await createTestUser(payload, {
      programStatus: 'active',
      programStartDate: startDate.toISOString(),
    })
    userIds.push(user.id)

    const attempt = await createTestAttempt(payload, user.id, {
      startedAt: startDate.toISOString(),
    })

    // Run miss check — should detect 3+ misses and fail
    const result = await checkAndProcessMisses(payload, attempt.id)
    expect(result.failed).toBe(true)

    // Verify attempt is failed
    const failedAttempt = await payload.findByID({
      collection: 'attempts',
      id: attempt.id,
    }) as any
    expect(failedAttempt.status).toBe('failed')
    expect(failedAttempt.missCount).toBe(3)
    expect(failedAttempt.endedAt).toBeTruthy()

    // Verify user status
    const failedUser = await payload.findByID({
      collection: 'users',
      id: user.id,
    }) as any
    expect(failedUser.programStatus).toBe('failed')
  })
})

describe('Full Journey: Gate Review Flow', () => {
  it('gate pass allows continuation', async () => {
    const startDate = new Date(Date.now() - 16 * 86400000)
    const { user: founder } = await createTestUser(payload, {
      role: 'founder',
      programStatus: 'active',
      programStartDate: startDate.toISOString(),
    })
    const { user: mentor } = await createTestUser(payload, { role: 'mentor' })
    userIds.push(founder.id, mentor.id)

    const attempt = await createTestAttempt(payload, founder.id, {
      startedAt: startDate.toISOString(),
    })

    // Submit days 1-15
    for (let d = 1; d <= 15; d++) {
      await submitForm(payload, founder.id, dayForm.id, {
        programDay: d,
        dayType: d === 15 ? 'gate' : (d === 7 ? 'retro' : 'standard'),
        attempt: attempt.id,
      })
    }

    // Get gate submission
    const gateSubs = await payload.find({
      collection: 'founder-form-submissions',
      where: { user: { equals: founder.id }, programDay: { equals: 15 } },
      limit: 1,
    })
    const gateSub = gateSubs.docs[0]

    // Mentor passes gate
    const review = await payload.create({
      collection: 'mentor-reviews',
      data: {
        submission: gateSub.id,
        reviewer: mentor.id,
        dayNumber: 15,
        score: 5,
        comment: 'Excellent work, gate passed!',
        isGateReview: true,
        gateDecision: 'pass',
      },
    }) as any

    expect(review.gateDecision).toBe('pass')

    // Attempt should still be active
    const activeAttempt = await payload.findByID({
      collection: 'attempts',
      id: attempt.id,
    }) as any
    expect(activeAttempt.status).not.toBe('failed')
  })
})

describe('Full Journey: Second Attempt After Failure', () => {
  it('failed user starts second attempt', async () => {
    const { user } = await createTestUser(payload, {
      programStatus: 'failed',
      programAttempts: 1,
      hasPaid100Days: true,
    })
    userIds.push(user.id)

    // First attempt (failed)
    await createTestAttempt(payload, user.id, {
      attemptNumber: 1,
      status: 'failed',
      missCount: 3,
      endedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      startedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    })

    // Reactivate user for second attempt
    const reactivated = await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        programStatus: 'active',
        programAttempts: 2,
        programStartDate: new Date().toISOString(),
      },
    }) as any
    expect(reactivated.programStatus).toBe('active')
    expect(reactivated.programAttempts).toBe(2)

    // Create second attempt
    const attempt2 = await createTestAttempt(payload, user.id, {
      attemptNumber: 2,
      status: 'active',
    })
    expect(attempt2.attemptNumber).toBe(2)
    expect(attempt2.status).toBe('active')
    expect(attempt2.missCount).toBe(0)

    // Verify two attempts exist
    const attempts = await payload.find({
      collection: 'attempts',
      where: { user: { equals: user.id } },
      sort: 'attemptNumber',
    })
    expect(attempts.totalDocs).toBe(2)
    expect((attempts.docs[0] as any).status).toBe('failed')
    expect((attempts.docs[1] as any).status).toBe('active')
  })
})

describe('Full Journey: Completion', () => {
  it('founder completes all 100 days', async () => {
    const startDate = new Date(Date.now() - 101 * 86400000)
    const { user } = await createTestUser(payload, {
      programStatus: 'active',
      programStartDate: startDate.toISOString(),
      hasPaid100Days: true,
    })
    userIds.push(user.id)

    const attempt = await createTestAttempt(payload, user.id, {
      startedAt: startDate.toISOString(),
    })

    // Submit all 100 days (just day 1 and day 100 for speed)
    await submitForm(payload, user.id, dayForm.id, {
      programDay: 1,
      dayType: 'standard',
      attempt: attempt.id,
    })
    await submitForm(payload, user.id, dayForm.id, {
      programDay: 100,
      dayType: 'standard',
      attempt: attempt.id,
    })

    // Mark attempt as completed
    const completed = await payload.update({
      collection: 'attempts',
      id: attempt.id,
      data: {
        status: 'completed',
        endedAt: new Date().toISOString(),
        currentDay: 100,
      },
    }) as any

    expect(completed.status).toBe('completed')
    expect(completed.endedAt).toBeTruthy()
    expect(completed.currentDay).toBe(100)

    // Update user status
    const graduatedUser = await payload.update({
      collection: 'users',
      id: user.id,
      data: { programStatus: 'completed' },
    }) as any
    expect(graduatedUser.programStatus).toBe('completed')
  })
})
