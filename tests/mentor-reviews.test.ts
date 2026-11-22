/**
 * Integration tests for mentor reviews and gate decisions.
 * Tests review creation, gate pass/fail/revise, and state transitions.
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
  form = await createTestForm(payload, { slug: `review-form-${Date.now()}` })
})

afterAll(async () => {
  for (const id of userIds) await cleanupUser(payload, id)
  await cleanupForm(payload, form.id)
})

describe('Mentor Reviews: Basic CRUD', () => {
  it('creates a review for a submission', async () => {
    const { user: founder } = await createTestUser(payload, { role: 'founder' })
    const { user: mentor } = await createTestUser(payload, { role: 'mentor' })
    userIds.push(founder.id, mentor.id)

    const sub = await submitForm(payload, founder.id, form.id, {
      programDay: 1,
      dayType: 'standard',
    })

    const review = await payload.create({
      collection: 'mentor-reviews',
      data: {
        submission: sub.id,
        reviewer: mentor.id,
        dayNumber: 1,
        score: 4,
        comment: 'Good work on the first day!',
      },
    }) as any

    expect(review.id).toBeTruthy()
    expect(review.score).toBe(4)
    expect(review.comment).toBe('Good work on the first day!')
    expect(review.isGateReview).toBe(false)
  })

  it('review links to correct submission and reviewer', async () => {
    const { user: founder } = await createTestUser(payload, { role: 'founder' })
    const { user: mentor } = await createTestUser(payload, { role: 'mentor' })
    userIds.push(founder.id, mentor.id)

    const sub = await submitForm(payload, founder.id, form.id, { programDay: 2 })

    const review = await payload.create({
      collection: 'mentor-reviews',
      data: {
        submission: sub.id,
        reviewer: mentor.id,
        dayNumber: 2,
        score: 3,
        comment: 'Needs improvement',
      },
    }) as any

    const fetched = await payload.findByID({
      collection: 'mentor-reviews',
      id: review.id,
      depth: 1,
    }) as any

    const subRef = typeof fetched.submission === 'object' ? fetched.submission.id : fetched.submission
    const revRef = typeof fetched.reviewer === 'object' ? fetched.reviewer.id : fetched.reviewer
    expect(subRef).toBe(sub.id)
    expect(revRef).toBe(mentor.id)
  })

  it('review with internal note (admin-only field)', async () => {
    const { user: founder } = await createTestUser(payload, { role: 'founder' })
    const { user: mentor } = await createTestUser(payload, { role: 'mentor' })
    userIds.push(founder.id, mentor.id)

    const sub = await submitForm(payload, founder.id, form.id, { programDay: 3 })

    const review = await payload.create({
      collection: 'mentor-reviews',
      data: {
        submission: sub.id,
        reviewer: mentor.id,
        dayNumber: 3,
        score: 2,
        comment: 'Public feedback',
        internalNote: 'Founder seems disengaged',
      },
    }) as any

    expect(review.internalNote).toBe('Founder seems disengaged')
  })
})

describe('Mentor Reviews: Gate Decisions', () => {
  it('gate review with pass decision', async () => {
    const { user: founder } = await createTestUser(payload, { role: 'founder' })
    const { user: mentor } = await createTestUser(payload, { role: 'mentor' })
    userIds.push(founder.id, mentor.id)

    const sub = await submitForm(payload, founder.id, form.id, {
      programDay: 15,
      dayType: 'gate',
    })

    const review = await payload.create({
      collection: 'mentor-reviews',
      data: {
        submission: sub.id,
        reviewer: mentor.id,
        dayNumber: 15,
        score: 5,
        comment: 'Excellent gate submission',
        isGateReview: true,
        gateDecision: 'pass',
      },
    }) as any

    expect(review.isGateReview).toBe(true)
    expect(review.gateDecision).toBe('pass')
  })

  it('gate review with revise decision', async () => {
    const { user: founder } = await createTestUser(payload, { role: 'founder' })
    const { user: mentor } = await createTestUser(payload, { role: 'mentor' })
    userIds.push(founder.id, mentor.id)

    const sub = await submitForm(payload, founder.id, form.id, {
      programDay: 30,
      dayType: 'gate',
    })

    const review = await payload.create({
      collection: 'mentor-reviews',
      data: {
        submission: sub.id,
        reviewer: mentor.id,
        dayNumber: 30,
        score: 2,
        comment: 'Needs revision — resubmit within 48h',
        isGateReview: true,
        gateDecision: 'revise',
      },
    }) as any

    expect(review.gateDecision).toBe('revise')
  })

  it('gate review with fail triggers attempt failure via hook', async () => {
    const startDate = new Date(Date.now() - 16 * 86400000)
    const { user: founder } = await createTestUser(payload, {
      role: 'founder',
      programStatus: 'active',
      programStartDate: startDate.toISOString(),
    })
    const { user: mentor } = await createTestUser(payload, { role: 'mentor' })
    userIds.push(founder.id, mentor.id)

    const attempt = await createTestAttempt(payload, founder.id, {
      startedAt: startDate.toISOString(),
    })

    const sub = await submitForm(payload, founder.id, form.id, {
      programDay: 15,
      dayType: 'gate',
      attempt: attempt.id,
    })

    // Gate fail triggers gateDecisionAfterChange hook
    await payload.create({
      collection: 'mentor-reviews',
      data: {
        submission: sub.id,
        reviewer: mentor.id,
        dayNumber: 15,
        score: 1,
        comment: 'Gate failed',
        isGateReview: true,
        gateDecision: 'fail',
      },
    })

    // Check that attempt was failed by the hook
    const updated = await payload.findByID({ collection: 'attempts', id: attempt.id }) as any
    expect(updated.status).toBe('failed')
    expect(updated.endedAt).toBeTruthy()

    // Check user status was updated
    const updatedUser = await payload.findByID({ collection: 'users', id: founder.id }) as any
    expect(updatedUser.programStatus).toBe('failed')
  })

  it('gate checklist is stored as JSON', async () => {
    const { user: founder } = await createTestUser(payload, { role: 'founder' })
    const { user: mentor } = await createTestUser(payload, { role: 'mentor' })
    userIds.push(founder.id, mentor.id)

    const sub = await submitForm(payload, founder.id, form.id, {
      programDay: 50,
      dayType: 'gate',
    })

    const review = await payload.create({
      collection: 'mentor-reviews',
      data: {
        submission: sub.id,
        reviewer: mentor.id,
        dayNumber: 50,
        score: 4,
        comment: 'Gate passed',
        isGateReview: true,
        gateDecision: 'pass',
        gateChecklistCompleted: ['pitch_deck', 'financial_model', 'customer_interviews'],
      },
    }) as any

    expect(review.gateChecklistCompleted).toEqual(['pitch_deck', 'financial_model', 'customer_interviews'])
  })
})

describe('Mentor Reviews: Score Validation', () => {
  it('score within valid range (1-5)', async () => {
    const { user: founder } = await createTestUser(payload, { role: 'founder' })
    const { user: mentor } = await createTestUser(payload, { role: 'mentor' })
    userIds.push(founder.id, mentor.id)

    const sub = await submitForm(payload, founder.id, form.id, { programDay: 1 })

    for (const score of [1, 2, 3, 4, 5]) {
      const r = await payload.create({
        collection: 'mentor-reviews',
        data: {
          submission: sub.id,
          reviewer: mentor.id,
          dayNumber: 1,
          score,
          comment: `Score ${score}`,
        },
      }) as any
      expect(r.score).toBe(score)
    }
  })
})
