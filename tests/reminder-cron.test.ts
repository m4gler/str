import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import {
  cleanupUser,
  createTestAttempt,
  createTestUser,
  getTestPayload,
} from './helpers'

vi.mock('@/lib/notifications', () => ({
  notifyGateFail: vi.fn(async () => undefined),
  notifyPartnerReminder: vi.fn(async () => undefined),
}))

vi.mock('@/lib/telegram', () => ({
  notifyTelegram: vi.fn(async () => undefined),
}))

import { runReminderCron } from '@/lib/reminderCron'

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

describe('runReminderCron', () => {
  it('does not advance miss state for active attempts', async () => {
    const startDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    const { user } = await createTestUser(payload, {
      programStatus: 'active',
      programStartDate: startDate,
    })
    userIds.push(user.id)

    const attempt = await createTestAttempt(payload, user.id, {
      startedAt: startDate,
    })

    const result = await runReminderCron(payload, 'http://localhost:3000')
    const updatedAttempt = await payload.findByID({ collection: 'attempts', id: attempt.id }) as any

    expect(result.gateFailures).toBe(0)
    expect(result.partnerReminders).toBe(0)
    expect(result.partnerEscalations).toBe(0)
    expect(updatedAttempt.status).toBe('active')
    expect(updatedAttempt.missCount).toBe(0)
    expect(updatedAttempt.missedDays).toEqual([])
  })
})

