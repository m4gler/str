import { beforeEach, describe, expect, it, vi } from 'vitest'

import { notifyProjectSubmissionCreatedAlert } from '@/lib/notifications'

describe('Submission notifications', () => {
  const findGlobalMock = vi.fn()
  const sendEmailMock = vi.fn()

  beforeEach(() => {
    findGlobalMock.mockReset()
    sendEmailMock.mockReset()
    sendEmailMock.mockResolvedValue(undefined)
  })

  it('sends project submission alerts to the configured Payload recipient', async () => {
    findGlobalMock.mockResolvedValue({
      notifications: {
        newSubmissionAlertEmail: 'reviewer@example.com',
      },
    })

    await notifyProjectSubmissionCreatedAlert(
      {
        findGlobal: findGlobalMock,
        sendEmail: sendEmailMock,
      } as any,
      {
        submissionId: 42,
        submitterEmail: 'founder@example.com',
        trackName: 'Space',
        projectDescription: 'Earth observation workflow for agriculture teams.',
      },
      'https://mesga.example',
    )

    expect(findGlobalMock).toHaveBeenCalledWith({ slug: 'platform-settings' })
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'reviewer@example.com',
        subject: 'New project submission from founder@example.com',
        html: expect.stringContaining('/admin/collections/project-submissions/42'),
      }),
    )
    expect(sendEmailMock.mock.calls[0]?.[0]?.html).toContain('Earth observation workflow for agriculture teams.')
    expect(sendEmailMock.mock.calls[0]?.[0]?.html).toContain('Space')
  })

  it('skips project submission alerts when the configured recipient is blank', async () => {
    findGlobalMock.mockResolvedValue({
      notifications: {
        newSubmissionAlertEmail: '   ',
      },
    })

    await notifyProjectSubmissionCreatedAlert(
      {
        findGlobal: findGlobalMock,
        sendEmail: sendEmailMock,
      } as any,
      {
        submissionId: 55,
      },
      'https://mesga.example',
    )

    expect(sendEmailMock).not.toHaveBeenCalled()
  })
})
