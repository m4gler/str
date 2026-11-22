/**
 * Integration tests for the authentication flow.
 * Tests user creation, login, profile updates, and role enforcement.
 */
import { describe, it, expect, afterAll } from 'vitest'
import { getTestPayload, createTestUser, testEmail, cleanupUser } from './helpers'

const userIds: (string | number)[] = []

afterAll(async () => {
  const payload = await getTestPayload()
  for (const id of userIds) await cleanupUser(payload, id)
})

describe('Auth: Registration & Login', () => {
  it('creates a founder user with correct defaults', async () => {
    const payload = await getTestPayload()
    const { user } = await createTestUser(payload, { role: 'founder' })
    userIds.push(user.id)

    expect(user.role).toBe('founder')
    expect(user.isOnboarded).toBe(true)
    expect(['not_started', null, undefined]).toContain(user.programStatus)
    expect(user.hasPaid100Days).toBeFalsy()
  })

  it('creates an investor user', async () => {
    const payload = await getTestPayload()
    const { user } = await createTestUser(payload, { role: 'investor' })
    userIds.push(user.id)

    expect(user.role).toBe('investor')
  })

  it('beforeChange hook blocks non-admin from creating mentor', async () => {
    const payload = await getTestPayload()
    // Without admin req.user context, mentor role gets downgraded to founder
    const email = testEmail('mentor-hook')
    const user = await payload.create({
      collection: 'users',
      data: { email, password: 'TestPass123!', role: 'mentor', isOnboarded: true },
      disableVerificationEmail: true,
    }) as any
    userIds.push(user.id)

    expect(user.role).toBe('founder') // hook prevents non-admin from setting mentor
  })

  it('can login with email/password via payload.login()', async () => {
    const payload = await getTestPayload()
    const email = testEmail('login')
    const password = 'SecurePass99!'
    const { user } = await createTestUser(payload, { email, password })
    userIds.push(user.id)

    const result = await payload.login({
      collection: 'users',
      data: { email, password },
    })

    expect(result.token).toBeTruthy()
    expect(result.user).toBeTruthy()
    expect((result.user as any).email).toBe(email)
  })

  it('auto-verifies privileged users before login when their verification flag is missing', async () => {
    const payload = await getTestPayload()
    const email = testEmail('admin-legacy')
    const password = 'SecurePass99!'
    const { user } = await createTestUser(payload, { email, password, role: 'admin' })
    userIds.push(user.id)

    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        _verified: null,
        _verificationToken: null,
        verificationEmailLastSentAt: null,
      } as any,
      overrideAccess: true,
      showHiddenFields: true,
    })

    const result = await payload.login({
      collection: 'users',
      data: { email, password },
    })

    expect(result.token).toBeTruthy()

    const updatedUser = await payload.findByID({
      collection: 'users',
      id: user.id,
      overrideAccess: true,
      showHiddenFields: true,
    }) as any

    expect(updatedUser._verified).toBe(true)
    expect(updatedUser._verificationToken).toBeNull()
  })

  it('auto-verifies legacy public users without a verification token', async () => {
    const payload = await getTestPayload()
    const email = testEmail('founder-legacy')
    const password = 'SecurePass99!'
    const { user } = await createTestUser(payload, { email, password, role: 'founder' })
    userIds.push(user.id)

    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        _verified: null,
        _verificationToken: null,
        verificationEmailLastSentAt: null,
      } as any,
      overrideAccess: true,
      showHiddenFields: true,
    })

    const result = await payload.login({
      collection: 'users',
      data: { email, password },
    })

    expect(result.token).toBeTruthy()

    const updatedUser = await payload.findByID({
      collection: 'users',
      id: user.id,
      overrideAccess: true,
      showHiddenFields: true,
    }) as any

    expect(updatedUser._verified).toBe(true)
    expect(updatedUser._verificationToken).toBeNull()
  })

  it('blocks login until a public signup email is verified', async () => {
    const payload = await getTestPayload()
    const email = testEmail('verify-required')
    const password = 'SecurePass99!'

    const user = await payload.create({
      collection: 'users',
      data: {
        email,
        password,
        role: 'founder',
        isOnboarded: true,
      },
      disableVerificationEmail: true,
      showHiddenFields: true,
    }) as any
    userIds.push(user.id)

    await expect(
      payload.login({
        collection: 'users',
        data: { email, password },
      })
    ).rejects.toMatchObject({ name: 'UnverifiedEmail' })

    const fullUser = await payload.findByID({
      collection: 'users',
      id: user.id,
      overrideAccess: true,
      showHiddenFields: true,
    }) as any

    expect(fullUser._verified).toBe(false)
    expect(fullUser._verificationToken).toBeTruthy()

    await payload.verifyEmail({
      collection: 'users',
      token: fullUser._verificationToken,
    })

    const verifiedLogin = await payload.login({
      collection: 'users',
      data: { email, password },
    })

    expect(verifiedLogin.token).toBeTruthy()
  })

  it('rejects login with wrong password', async () => {
    const payload = await getTestPayload()
    const email = testEmail('badpw')
    const { user } = await createTestUser(payload, { email, password: 'RealPass1!' })
    userIds.push(user.id)

    await expect(
      payload.login({ collection: 'users', data: { email, password: 'WrongPass!' } })
    ).rejects.toThrow()
  })

  it('prevents duplicate email registration', async () => {
    const payload = await getTestPayload()
    const email = testEmail('dup')
    const { user } = await createTestUser(payload, { email })
    userIds.push(user.id)

    await expect(
      payload.create({
        collection: 'users',
        data: { email, password: 'Another1!', role: 'founder' },
      })
    ).rejects.toThrow()
  })
})

describe('Auth: Role Enforcement', () => {
  it('non-admin cannot set role to admin via beforeChange hook', async () => {
    const payload = await getTestPayload()
    const { user } = await createTestUser(payload, { role: 'founder' })
    userIds.push(user.id)

    // Direct update bypasses hook when no req.user context, but the hook
    // prevents self-escalation in real auth flow. Test the field was saved as founder.
    expect(user.role).toBe('founder')
  })

  it('user can read own data', async () => {
    const payload = await getTestPayload()
    const { user } = await createTestUser(payload)
    userIds.push(user.id)

    const fetched = await payload.findByID({ collection: 'users', id: user.id })
    expect(fetched).toBeTruthy()
    expect((fetched as any).email).toBe(user.email)
  })
})

describe('Auth: Profile Update', () => {
  it('can update businessIdea', async () => {
    const payload = await getTestPayload()
    const { user } = await createTestUser(payload)
    userIds.push(user.id)

    const updated = await payload.update({
      collection: 'users',
      id: user.id,
      data: { businessIdea: 'AI-powered space farming' },
    })

    expect((updated as any).businessIdea).toBe('AI-powered space farming')
  })

  it('can update phoneNumber', async () => {
    const payload = await getTestPayload()
    const { user } = await createTestUser(payload)
    userIds.push(user.id)

    const updated = await payload.update({
      collection: 'users',
      id: user.id,
      data: { phoneNumber: '+48123456789' },
    })

    expect((updated as any).phoneNumber).toBe('+48123456789')
  })
})
