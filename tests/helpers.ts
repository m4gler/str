/**
 * Shared test helpers — Payload instance, user factory, cleanup.
 */
import { getPayload, type Payload } from 'payload'
import config from '../src/payload.config'

let _payload: Payload | null = null

/** Get or initialize the shared Payload instance. */
export async function getTestPayload(): Promise<Payload> {
  if (!_payload) {
    _payload = await getPayload({ config })
  }
  return _payload
}

/** Generate a unique email for test isolation. */
export function testEmail(prefix = 'test'): string {
  const id = Math.random().toString(36).slice(2, 10)
  return `${prefix}-${id}@test.mesga.local`
}

/** Create a test user and return it. */
export async function createTestUser(
  payload: Payload,
  overrides: Record<string, any> = {},
) {
  const email = overrides.email || testEmail()
  const password = overrides.password || 'TestPass123!'
  const role = overrides.role || 'founder'

  // The beforeChange hook blocks non-admin from setting mentor/partner/admin roles.
  // Pass a fake admin user context so the hook allows any role.
  const fakeAdmin = { id: 'test-admin', role: 'admin', collection: 'users' } as any
  const user = await payload.create({
    collection: 'users',
    disableVerificationEmail: true,
    data: {
      email,
      password,
      role,
      isOnboarded: true,
      ...overrides,
    },
    user: fakeAdmin,
  })

  return { user: user as any, email, password }
}

/** Create a minimal FounderForm for testing. */
export async function createTestForm(
  payload: Payload,
  overrides: Record<string, any> = {},
) {
  const slug = overrides.slug || `test-form-${Math.random().toString(36).slice(2, 8)}`
  const form = await payload.create({
    collection: 'founder-forms',
    data: {
      title: overrides.title || `Test Form ${slug}`,
      slug,
      allowMultipleSubmissions: overrides.allowMultipleSubmissions ?? true,
      sections: overrides.sections || [
        {
          id: 'test-section-1',
          title: 'Test Section',
          questions: [
            {
              question_id: 'q1',
              question_text: 'Test Question',
              question_type: 'short_text',
              required: true,
            },
            {
              question_id: 'q2',
              question_text: 'Optional Question',
              question_type: 'long_text',
              required: false,
            },
          ],
        },
      ],
    },
  })
  return form as any
}

/** Create a test attempt for a user. */
export async function createTestAttempt(
  payload: Payload,
  userId: number,
  overrides: Record<string, any> = {},
) {
  const attempt = await payload.create({
    collection: 'attempts',
    data: {
      user: userId,
      attemptNumber: 1,
      status: 'active',
      missCount: 0,
      missedDays: [],
      startedAt: new Date().toISOString(),
      paymentType: 'self_paid',
      currentDay: 1,
      ...overrides,
    },
  })
  return attempt as any
}

/** Submit a form for a user. */
export async function submitForm(
  payload: Payload,
  userId: number,
  formId: number,
  overrides: Record<string, any> = {},
) {
  const sub = await payload.create({
    collection: 'founder-form-submissions',
    data: {
      user: userId,
      form: formId,
      submissionData: overrides.submissionData || { q1: 'test answer' },
      email: overrides.email || 'test@test.local',
      ...overrides,
    },
  })
  return sub as any
}

/** Delete a test user and all related data. */
export async function cleanupUser(payload: Payload, userId: number) {
  try {
    // Delete submissions
    const subs = await payload.find({
      collection: 'founder-form-submissions',
      where: { user: { equals: userId } },
      limit: 500,
    })
    for (const sub of subs.docs) {
      // Delete related auto-check results
      await payload.delete({
        collection: 'auto-check-results',
        where: { submission: { equals: sub.id } },
      }).catch(() => {})
      // Delete related mentor reviews
      await payload.delete({
        collection: 'mentor-reviews',
        where: { submission: { equals: sub.id } },
      }).catch(() => {})
      await payload.delete({ collection: 'founder-form-submissions', id: sub.id })
    }
    // Delete attempts
    await payload.delete({
      collection: 'attempts',
      where: { user: { equals: userId } },
    }).catch(() => {})
    // Delete project submissions
    await payload.delete({
      collection: 'project-submissions',
      where: { user: { equals: userId } },
    }).catch(() => {})
    // Delete ecosystem items
    await payload.delete({
      collection: 'ecosystem-items',
      where: { user: { equals: userId } },
    }).catch(() => {})
    // Delete intro requests
    await payload.delete({
      collection: 'intro-requests',
      where: { user: { equals: userId } },
    }).catch(() => {})
    // Delete user
    await payload.delete({ collection: 'users', id: userId })
  } catch (e) {
    // Best-effort cleanup
  }
}

/** Clean up a test form. */
export async function cleanupForm(payload: Payload, formId: number) {
  try {
    await payload.delete({ collection: 'founder-forms', id: formId })
  } catch {}
}
