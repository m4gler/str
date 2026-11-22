/**
 * Integration tests for form creation, submission, and validation.
 * Tests founder forms, daily forms, prework, and intake forms.
 */
import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import {
  getTestPayload,
  createTestUser,
  createTestForm,
  submitForm,
  cleanupUser,
  cleanupForm,
} from './helpers'
import type { Payload } from 'payload'

let payload: Payload
let testForm: any
const userIds: (string | number)[] = []

beforeAll(async () => {
  payload = await getTestPayload()
  testForm = await createTestForm(payload)
})

afterAll(async () => {
  for (const id of userIds) await cleanupUser(payload, id)
  await cleanupForm(payload, testForm.id)
})

describe('Forms: CRUD', () => {
  it('creates a form with sections and questions', async () => {
    expect(testForm.id).toBeTruthy()
    expect(testForm.slug).toBeTruthy()
    expect(testForm.sections).toHaveLength(1)
    expect(testForm.sections[0].questions).toHaveLength(2)
  })

  it('form questions have correct types', async () => {
    const qs = testForm.sections[0].questions
    expect(qs[0].question_type).toBe('short_text')
    expect(qs[0].required).toBe(true)
    expect(qs[1].question_type).toBe('long_text')
    expect(qs[1].required).toBe(false)
  })

  it('can find form by slug', async () => {
    const found = await payload.find({
      collection: 'founder-forms',
      where: { slug: { equals: testForm.slug } },
      limit: 1,
    })
    expect(found.totalDocs).toBe(1)
    expect(found.docs[0].id).toBe(testForm.id)
  })
})

describe('Forms: Submissions', () => {
  it('creates a submission with submissionData', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)

    const sub = await submitForm(payload, user.id, testForm.id, {
      submissionData: { q1: 'My answer', q2: 'Extra detail' },
      email: user.email,
    })

    expect(sub.id).toBeTruthy()
    expect(sub.submissionData.q1).toBe('My answer')
    expect(sub.submissionData.q2).toBe('Extra detail')
  })

  it('submission links to user and form', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)

    const sub = await submitForm(payload, user.id, testForm.id)

    const fetched = await payload.findByID({
      collection: 'founder-form-submissions',
      id: sub.id,
      depth: 1,
    }) as any

    const formRef = typeof fetched.form === 'object' ? fetched.form.id : fetched.form
    const userRef = typeof fetched.user === 'object' ? fetched.user.id : fetched.user
    expect(formRef).toBe(testForm.id)
    expect(userRef).toBe(user.id)
  })

  it('allowMultipleSubmissions=true allows re-submission', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)

    await submitForm(payload, user.id, testForm.id)
    const sub2 = await submitForm(payload, user.id, testForm.id, {
      submissionData: { q1: 'second try' },
    })

    expect(sub2.id).toBeTruthy()

    const all = await payload.find({
      collection: 'founder-form-submissions',
      where: { user: { equals: user.id }, form: { equals: testForm.id } },
    })
    expect(all.totalDocs).toBe(2)
  })

  it('submission with programDay tracks day correctly', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)

    const sub = await submitForm(payload, user.id, testForm.id, {
      programDay: 5,
      dayType: 'standard',
    })

    expect(sub.programDay).toBe(5)
    expect(sub.dayType).toBe('standard')
  })

  it('backfill submission marked correctly', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)

    const sub = await submitForm(payload, user.id, testForm.id, {
      programDay: 3,
      isBackfill: true,
    })

    expect(sub.isBackfill).toBe(true)
  })
})

describe('Forms: Day Types', () => {
  it('submission with dayType standard', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)
    const sub = await submitForm(payload, user.id, testForm.id, { dayType: 'standard', programDay: 1 })
    expect(sub.dayType).toBe('standard')
  })

  it('submission with dayType retro', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)
    const sub = await submitForm(payload, user.id, testForm.id, { dayType: 'retro', programDay: 7 })
    expect(sub.dayType).toBe('retro')
  })

  it('submission with dayType gate', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)
    const sub = await submitForm(payload, user.id, testForm.id, { dayType: 'gate', programDay: 15 })
    expect(sub.dayType).toBe('gate')
  })

  it('submission with dayType prework', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)
    const sub = await submitForm(payload, user.id, testForm.id, { dayType: 'prework' })
    expect(sub.dayType).toBe('prework')
  })
})

describe('Forms: Status Tracking', () => {
  it('submission defaults to status new', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)
    const sub = await submitForm(payload, user.id, testForm.id)
    expect(sub.status).toBe('new')
  })

  it('admin can update submission status to reviewed', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)
    const sub = await submitForm(payload, user.id, testForm.id)

    const updated = await payload.update({
      collection: 'founder-form-submissions',
      id: sub.id,
      data: { status: 'reviewed' },
    })
    expect((updated as any).status).toBe('reviewed')
  })
})
