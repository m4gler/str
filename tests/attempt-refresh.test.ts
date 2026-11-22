import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import {
  cleanupUser,
  createTestAttempt,
  createTestUser,
  getTestPayload,
} from './helpers'
import { ensureFreshAttemptState } from '@/lib/ensureFreshAttemptState'

let payload: Payload
const userIds: Array<string | number> = []

beforeAll(async () => {
  payload = await getTestPayload()
})

afterAll(async () => {
  for (const userId of userIds) {
    await cleanupUser(payload, userId)
  }
})

describe('ensureFreshAttemptState', () => {
  it('activates prework users lazily on page load when the start date is reached', async () => {
    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { user } = await createTestUser(payload, {
      programStatus: 'prework',
      programStartDate: startDate,
    })
    userIds.push(user.id)
    await createTestAttempt(payload, user.id, {
      startedAt: startDate,
    })

    const result = await ensureFreshAttemptState(payload, user)

    expect(result.programStatus).toBe('active')
    expect(result.user.programStatus).toBe('active')
  })

  it('fails stale active attempts on page load instead of waiting for cron', async () => {
    const startDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    const { user } = await createTestUser(payload, {
      programStatus: 'active',
      programStartDate: startDate,
    })
    userIds.push(user.id)

    const attempt = await createTestAttempt(payload, user.id, {
      startedAt: startDate,
    })

    const result = await ensureFreshAttemptState(payload, user)
    const updatedAttempt = await payload.findByID({ collection: 'attempts', id: attempt.id }) as any
    const updatedUser = await payload.findByID({ collection: 'users', id: user.id }) as any

    expect(result.missCheck?.failed).toBe(true)
    expect(updatedAttempt.status).toBe('failed')
    expect(updatedUser.programStatus).toBe('failed')
  })

  it('does not fail a fresh retry attempt because the user has a stale program start date', async () => {
    const staleStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const freshAttemptStart = new Date().toISOString()
    const { user } = await createTestUser(payload, {
      programStatus: 'active',
      programStartDate: staleStartDate,
      programAttempts: 2,
      hasPaid100Days: true,
    })
    userIds.push(user.id)

    const failedAttempt = await createTestAttempt(payload, user.id, {
      attemptNumber: 1,
      status: 'failed',
      missCount: 3,
      missedDays: [1, 2, 3],
      startedAt: staleStartDate,
      endedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    })
    const retryAttempt = await createTestAttempt(payload, user.id, {
      attemptNumber: 2,
      status: 'active',
      startedAt: freshAttemptStart,
    })

    const result = await ensureFreshAttemptState(payload, user)
    const updatedRetryAttempt = await payload.findByID({ collection: 'attempts', id: retryAttempt.id }) as any
    const updatedFailedAttempt = await payload.findByID({ collection: 'attempts', id: failedAttempt.id }) as any
    const updatedUser = await payload.findByID({ collection: 'users', id: user.id }) as any

    expect(result.missCheck?.missesDetected).toBe(0)
    expect(updatedRetryAttempt.status).toBe('active')
    expect(updatedRetryAttempt.missCount).toBe(0)
    expect(updatedRetryAttempt.missedDays).toEqual([])
    expect(updatedFailedAttempt.status).toBe('failed')
    expect(updatedUser.programStatus).toBe('active')
  })

  it('repairs stale active users with no active attempt', async () => {
    const { user } = await createTestUser(payload, {
      programStatus: 'active',
      programStartDate: new Date().toISOString(),
    })
    userIds.push(user.id)

    const result = await ensureFreshAttemptState(payload, user)
    const updatedUser = await payload.findByID({ collection: 'users', id: user.id }) as any

    expect(result.activeAttemptId).toBeNull()
    expect(updatedUser.programStatus).toBe('not_started')
  })
})
