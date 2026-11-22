import { describe, expect, it, vi } from 'vitest'
import { checkAndProcessMisses } from '@/lib/missCheck'

vi.mock('@/lib/notifications', () => ({
  notifyMiss1: vi.fn().mockResolvedValue(undefined),
  notifyMiss2: vi.fn().mockResolvedValue(undefined),
  notifyAttemptFailed: vi.fn().mockResolvedValue(undefined),
  notifyPartnerOverrideRequired: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/telegram', () => ({
  notifyTelegram: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/appUrl', () => ({
  getAppUrl: () => 'https://example.test',
}))

function createMissCheckPayload({
  attempt,
  submissions = [],
}: {
  attempt: any
  submissions?: any[]
}) {
  const updates: Array<{ collection: string; id: string | number; data: Record<string, any> }> = []

  return {
    updates,
    payload: {
      findByID: vi.fn(async ({ collection, id }: { collection: string; id: string | number }) => {
        if (collection === 'attempts' && String(id) === String(attempt.id)) return attempt
        return null
      }),
      findGlobal: vi.fn(async () => null),
      find: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'founder-form-submissions') return { docs: submissions }
        if (collection === 'users') return { docs: [] }
        return { docs: [] }
      }),
      update: vi.fn(async ({ collection, id, data }: { collection: string; id: string | number; data: Record<string, any> }) => {
        updates.push({ collection, id, data })
        if (collection === 'attempts') Object.assign(attempt, data)
        return { id, ...data }
      }),
    } as any,
  }
}

describe('checkAndProcessMisses', () => {
  it('uses the fresh active attempt start date instead of a stale user program start date', async () => {
    const attempt = {
      id: 42,
      user: {
        id: 7,
        email: 'founder@example.test',
        programStatus: 'active',
        programStartDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      status: 'active',
      missCount: 0,
      missedDays: [],
      attemptNumber: 2,
      paymentType: 'self_paid',
      startedAt: new Date().toISOString(),
    }
    const { payload, updates } = createMissCheckPayload({ attempt })

    const result = await checkAndProcessMisses(payload, attempt.id)

    expect(result.missesDetected).toBe(0)
    expect(result.failed).toBe(false)
    expect(updates).toEqual([])
  })
})
