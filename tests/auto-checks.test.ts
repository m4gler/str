/**
 * Integration tests for AutoCheckResults collection.
 * Tests creation, link checking, AI summary storage, and relationships.
 */
import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import {
  getTestPayload,
  createTestUser,
  createTestForm,
  createTestAttempt,
  submitForm,
  cleanupUser,
  cleanupForm,
} from './helpers'
import type { Payload } from 'payload'

let payload: Payload
let form: any
const userIds: (string | number)[] = []

beforeAll(async () => {
  payload = await getTestPayload()
  form = await createTestForm(payload, { slug: `autocheck-form-${Date.now()}` })
})

afterAll(async () => {
  for (const id of userIds) await cleanupUser(payload, id)
  await cleanupForm(payload, form.id)
})

describe('AutoCheckResults: CRUD', () => {
  it('creates an auto-check result', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)
    const attempt = await createTestAttempt(payload, user.id)
    const sub = await submitForm(payload, user.id, form.id, {
      programDay: 5,
      attempt: attempt.id,
    })

    const result = await payload.create({
      collection: 'auto-check-results',
      data: {
        submission: sub.id,
        user: user.id,
        attempt: attempt.id,
        dayNumber: 5,
        checksPassed: true,
        linkReachable: true,
        linkUrl: 'https://example.com/artifact',
        proofType: 'link',
      },
    }) as any

    expect(result.id).toBeTruthy()
    expect(result.checksPassed).toBe(true)
    expect(result.linkReachable).toBe(true)
    expect(result.dayNumber).toBe(5)
    expect(result.proofType).toBe('link')
  })

  it('stores failed check with error message', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)
    const attempt = await createTestAttempt(payload, user.id)
    const sub = await submitForm(payload, user.id, form.id, {
      programDay: 10,
      attempt: attempt.id,
    })

    const result = await payload.create({
      collection: 'auto-check-results',
      data: {
        submission: sub.id,
        user: user.id,
        attempt: attempt.id,
        dayNumber: 10,
        checksPassed: false,
        linkReachable: false,
        linkUrl: 'https://broken-link.example.com',
        errorMessage: 'Link returned HTTP 404',
      },
    }) as any

    expect(result.checksPassed).toBe(false)
    expect(result.linkReachable).toBe(false)
    expect(result.errorMessage).toBe('Link returned HTTP 404')
  })
})

describe('AutoCheckResults: AI Summary', () => {
  it('stores AI summary JSON', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)
    const attempt = await createTestAttempt(payload, user.id)
    const sub = await submitForm(payload, user.id, form.id, {
      programDay: 15,
      attempt: attempt.id,
    })

    const aiSummary = {
      summary_3s: 'Founder built an MVP landing page with 50 signups.',
      key_output: 'Landing page + waitlist',
      decision: 'pass',
      learnings: 'Market validation through landing page tests',
      mentor_ask: 'Pricing strategy review',
      checks_passed: true,
      link_reachable: true,
      generated_at: new Date().toISOString(),
    }

    const result = await payload.create({
      collection: 'auto-check-results',
      data: {
        submission: sub.id,
        user: user.id,
        attempt: attempt.id,
        dayNumber: 15,
        checksPassed: true,
        linkReachable: true,
        aiSummary,
      },
    }) as any

    expect(result.aiSummary).toBeTruthy()
    expect(result.aiSummary.summary_3s).toContain('MVP landing page')
    expect(result.aiSummary.decision).toBe('pass')
  })

  it('stores autoCheckDetails JSON', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)
    const attempt = await createTestAttempt(payload, user.id)
    const sub = await submitForm(payload, user.id, form.id, {
      programDay: 20,
      attempt: attempt.id,
    })

    const autoCheckDetails = {
      fieldValidation: [
        { field: 'artifact_url', valid: true, reason: 'URL format valid' },
        { field: 'description', valid: true, reason: 'Min length met' },
      ],
      linkCheck: { status: 200, contentType: 'text/html', responseTimeMs: 450 },
      excerptLength: 250,
    }

    const result = await payload.create({
      collection: 'auto-check-results',
      data: {
        submission: sub.id,
        user: user.id,
        attempt: attempt.id,
        dayNumber: 20,
        checksPassed: true,
        autoCheckDetails,
      },
    }) as any

    expect(result.autoCheckDetails.fieldValidation).toHaveLength(2)
    expect(result.autoCheckDetails.linkCheck.status).toBe(200)
  })
})

describe('AutoCheckResults: Proof Types', () => {
  it('all proof types are accepted', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)
    const attempt = await createTestAttempt(payload, user.id)

    const proofTypes = ['link', 'video_link', 'file_pdf', 'file_ppt', 'file_doc', 'text', 'audio_link'] as const
    for (let i = 0; i < proofTypes.length; i++) {
      const sub = await submitForm(payload, user.id, form.id, {
        programDay: 30 + i,
        attempt: attempt.id,
      })

      const result = await payload.create({
        collection: 'auto-check-results',
        data: {
          submission: sub.id,
          user: user.id,
          attempt: attempt.id,
          dayNumber: 30 + i,
          checksPassed: true,
          proofType: proofTypes[i],
        },
      }) as any

      expect(result.proofType).toBe(proofTypes[i])
    }
  })
})

describe('AutoCheckResults: Relationships', () => {
  it('links to submission, user, and attempt', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)
    const attempt = await createTestAttempt(payload, user.id)
    const sub = await submitForm(payload, user.id, form.id, {
      programDay: 50,
      attempt: attempt.id,
    })

    const result = await payload.create({
      collection: 'auto-check-results',
      data: {
        submission: sub.id,
        user: user.id,
        attempt: attempt.id,
        dayNumber: 50,
        checksPassed: true,
      },
    }) as any

    const fetched = await payload.findByID({
      collection: 'auto-check-results',
      id: result.id,
      depth: 0,
    }) as any

    expect(fetched.submission).toBe(sub.id)
    expect(fetched.user).toBe(user.id)
    expect(fetched.attempt).toBe(attempt.id)
  })
})
