import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  after: vi.fn((task: () => Promise<void>) => {
    void task()
  }),
  getAppUrl: vi.fn(() => 'https://mesga.example'),
  queueFounderStatusAlert: vi.fn().mockResolvedValue({ sent: true }),
}))

vi.mock('next/server', () => ({
  after: mocks.after,
}))

vi.mock('@/lib/appUrl', () => ({
  getAppUrl: mocks.getAppUrl,
}))

vi.mock('@/lib/founderStatusAlerts', async () => {
  return {
    buildFounderPersonalityStatusAlertEvent: vi.fn(() => ({
      eventKey: 'milestone:personality-completed',
      eventLabel: 'Personality completed',
      source: 'personality',
    })),
    buildFounderProgramStatusAlertEvent: vi.fn((previousStatus: string, nextStatus: string) => (
      previousStatus === nextStatus
        ? null
        : {
            eventKey: `program-status:${previousStatus}->${nextStatus}`,
            eventLabel: '100 Days active',
            previousStatus,
            nextStatus,
          }
    )),
    queueFounderStatusAlert: mocks.queueFounderStatusAlert,
  }
})

vi.mock('@/lib/notifications', () => ({
  notifyUserRegistrationAlert: vi.fn(),
}))

import { FounderFormSubmissions } from '@/collections/FounderFormSubmissions'
import { Users } from '@/collections/Users'

describe('founder status alert hooks', () => {
  beforeEach(() => {
    mocks.after.mockClear()
    mocks.getAppUrl.mockClear()
    mocks.getAppUrl.mockReturnValue('https://mesga.example')
    mocks.queueFounderStatusAlert.mockClear()
    mocks.queueFounderStatusAlert.mockResolvedValue({ sent: true })
  })

  it('queues a founder status alert when programStatus changes', async () => {
    const afterChangeHook = Users.hooks?.afterChange?.[0]
    expect(afterChangeHook).toBeTypeOf('function')

    await afterChangeHook?.({
      doc: {
        id: 123,
        role: 'founder',
        programStatus: 'active',
      },
      previousDoc: {
        programStatus: 'prework',
      },
      operation: 'update',
      req: {
        context: {},
        payload: {},
      },
    } as any)

    expect(mocks.queueFounderStatusAlert).toHaveBeenCalledWith(
      {},
      123,
      {
        eventKey: 'program-status:prework->active',
        eventLabel: '100 Days active',
        previousStatus: 'prework',
        nextStatus: 'active',
      },
      'https://mesga.example',
    )
  })

  it('queues a personality status alert when the active personality form is submitted', async () => {
    const afterChangeHook = FounderFormSubmissions.hooks?.afterChange?.[0]
    expect(afterChangeHook).toBeTypeOf('function')

    const payload = {
      findGlobal: vi.fn().mockResolvedValue({
        activePersonalityTestForm: 77,
      }),
    }

    await afterChangeHook?.({
      doc: {
        id: 501,
        form: 77,
        user: 123,
      },
      operation: 'create',
      req: {
        context: {},
        payload,
      },
    } as any)

    await vi.waitFor(() => {
      expect(mocks.queueFounderStatusAlert).toHaveBeenCalledWith(
        payload,
        '123',
        {
          eventKey: 'milestone:personality-completed',
          eventLabel: 'Personality completed',
          source: 'personality',
        },
        'https://mesga.example',
      )
    })
  })
})
