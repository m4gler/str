import { beforeEach, describe, expect, it, vi } from 'vitest'

import { notifyFounderChatInvite } from '@/lib/notifications'

describe('Founder chat invite notification', () => {
  const findGlobalMock = vi.fn()
  const sendEmailMock = vi.fn()

  beforeEach(() => {
    findGlobalMock.mockReset()
    sendEmailMock.mockReset()
    sendEmailMock.mockResolvedValue(undefined)
  })

  it('sends the default founder chat invite email with the default WhatsApp link', async () => {
    findGlobalMock.mockResolvedValue({})

    await notifyFounderChatInvite(
      {
        findGlobal: findGlobalMock,
        sendEmail: sendEmailMock,
      } as any,
      {
        id: 123,
        email: 'founder@example.com',
        firstName: 'Ada',
        role: 'founder',
      },
    )

    expect(findGlobalMock).toHaveBeenCalledWith({ slug: 'platform-settings' })
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'founder@example.com',
        subject: 'Join the MESGA founder chat',
        html: expect.stringContaining('https://chat.whatsapp.com/G81fgIaVNYVGTNjGE6ijd6'),
      }),
    )
  })

  it('skips the founder chat invite when disabled in Payload settings', async () => {
    findGlobalMock.mockResolvedValue({
      notifications: {
        founderChatInviteEnabled: false,
      },
    })

    await notifyFounderChatInvite(
      {
        findGlobal: findGlobalMock,
        sendEmail: sendEmailMock,
      } as any,
      {
        id: 123,
        email: 'founder@example.com',
        role: 'founder',
      },
    )

    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('uses the configured subject, body, and invite link', async () => {
    findGlobalMock.mockResolvedValue({
      notifications: {
        founderChatInviteSubject: 'Welcome, {firstName}',
        founderChatInviteBody: 'Hi {firstName}, join here: {inviteLink}',
        founderChatInviteLink: 'https://chat.example/custom',
      },
    })

    await notifyFounderChatInvite(
      {
        findGlobal: findGlobalMock,
        sendEmail: sendEmailMock,
      } as any,
      {
        id: 123,
        email: 'founder@example.com',
        firstName: 'Ada',
        role: 'founder',
      },
    )

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'founder@example.com',
        subject: 'Welcome, Ada',
        html: expect.stringContaining('Hi Ada, join here:'),
      }),
    )
    expect(sendEmailMock.mock.calls[0]?.[0]?.html).toContain('https://chat.example/custom')
  })

  it('skips non-founder users', async () => {
    findGlobalMock.mockResolvedValue({})

    await notifyFounderChatInvite(
      {
        findGlobal: findGlobalMock,
        sendEmail: sendEmailMock,
      } as any,
      {
        id: 123,
        email: 'investor@example.com',
        role: 'investor',
      },
    )

    expect(sendEmailMock).not.toHaveBeenCalled()
  })
})
