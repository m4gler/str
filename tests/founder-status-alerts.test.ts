import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildFounderProgramStatusAlertEvent,
  queueFounderStatusAlert,
} from '@/lib/founderStatusAlerts'
import { notifyFounderStatusChangedAlert } from '@/lib/notifications'

describe('founder status alerts', () => {
  const findGlobalMock = vi.fn()
  const sendEmailMock = vi.fn()

  beforeEach(() => {
    findGlobalMock.mockReset()
    sendEmailMock.mockReset()
    sendEmailMock.mockResolvedValue(undefined)
  })

  it('renders operational status-change alerts to the configured alert recipient', async () => {
    findGlobalMock.mockResolvedValue({
      notifications: {
        newSubmissionAlertEmail: 'piotr@example.com',
      },
    })

    await notifyFounderStatusChangedAlert(
      {
        findGlobal: findGlobalMock,
        sendEmail: sendEmailMock,
      } as any,
      {
        userId: 123,
        email: 'founder@example.com',
        eventLabel: '100 Days active',
        previousStatus: 'prework',
        nextStatus: 'active',
      },
      'https://mesga.example',
    )

    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'piotr@example.com',
        subject: 'Founder status changed: founder@example.com → 100 Days active',
        html: expect.stringContaining('/admin/collections/users/123'),
      }),
    )
    expect(sendEmailMock.mock.calls[0]?.[0]?.html).toContain('prework')
    expect(sendEmailMock.mock.calls[0]?.[0]?.html).toContain('active')
  })

  it('does not send the same founder status alert twice', async () => {
    const updateMock = vi.fn()
    const notifyMock = vi.fn().mockResolvedValue(undefined)
    const payload = {
      findByID: vi.fn().mockResolvedValue({
        id: 123,
        role: 'founder',
        email: 'founder@example.com',
        founderStatusAlertHistory: [
          { eventKey: 'program-status:prework->active', sentAt: '2026-06-29T10:00:00.000Z' },
        ],
      }),
      update: updateMock,
    } as any

    const result = await queueFounderStatusAlert(
      payload,
      123,
      {
        eventKey: 'program-status:prework->active',
        eventLabel: '100 Days active',
        previousStatus: 'prework',
        nextStatus: 'active',
      },
      'https://mesga.example',
      notifyMock,
    )

    expect(result).toEqual({ sent: false, reason: 'already_sent' })
    expect(notifyMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('builds status events for real program-status transitions', () => {
    expect(buildFounderProgramStatusAlertEvent('prework', 'active')).toEqual({
      eventKey: 'program-status:prework->active',
      eventLabel: '100 Days active',
      previousStatus: 'prework',
      nextStatus: 'active',
    })

    expect(buildFounderProgramStatusAlertEvent('active', 'active')).toBeNull()
  })
})
