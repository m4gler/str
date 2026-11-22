import { beforeEach, describe, expect, it, vi } from 'vitest'

const payloadMock = {
  auth: vi.fn(),
  findByID: vi.fn(),
  findGlobal: vi.fn(),
  find: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}

const notifyFounderChatInviteMock = vi.fn()

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => payloadMock),
}))

vi.mock('@/payload.config', () => ({
  default: {},
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
  cookies: vi.fn(async () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('@/lib/notifications', async () => {
  const actual = await vi.importActual<typeof import('@/lib/notifications')>('@/lib/notifications')
  return {
    ...actual,
    notifyFounderChatInvite: notifyFounderChatInviteMock,
  }
})

describe('startProgramAttempt founder chat invite', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    const founder = {
      id: 123,
      email: 'founder@example.com',
      role: 'founder',
      hasPaid100Days: true,
      programAttempts: 0,
      partner: null,
      team: null,
    }

    payloadMock.auth.mockResolvedValue({ user: founder })
    payloadMock.findByID.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'users') return founder
      return null
    })
    payloadMock.findGlobal.mockImplementation(async ({ slug }: { slug: string }) => {
      if (slug === 'platform-settings') return { paymentEnabled: true }
      if (slug === 'day-program') return null
      return null
    })
    payloadMock.find.mockResolvedValue({ totalDocs: 0, docs: [] })
    payloadMock.create.mockResolvedValue({ id: 456 })
    payloadMock.update.mockResolvedValue({ ...founder, programAttempts: 1, programStatus: 'prework' })
    notifyFounderChatInviteMock.mockResolvedValue(undefined)
  })

  it('sends the founder chat invite when a founder starts the program attempt', async () => {
    const { startProgramAttempt } = await import('@/app/actions')

    const result = await startProgramAttempt(123)

    expect(result).toEqual({ success: true, attemptId: 456 })
    expect(notifyFounderChatInviteMock).toHaveBeenCalledTimes(1)
    expect(notifyFounderChatInviteMock).toHaveBeenCalledWith(payloadMock, expect.objectContaining({
      id: 123,
      email: 'founder@example.com',
      role: 'founder',
    }))
  })
})
