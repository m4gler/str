/**
 * Integration tests for ProjectSubmissions collection.
 * Tests CRUD, status transitions, track selection, and partner review.
 */
import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { getTestPayload, createTestUser, cleanupUser } from './helpers'
import type { Payload } from 'payload'
import { canFounderEditProjectSubmission, isProjectDescriptionRequiredForFounderSave } from '@/lib/projectSubmission'

let payload: Payload
const userIds: (string | number)[] = []
const projectIds: (string | number)[] = []
const trackIds: (string | number)[] = []

beforeAll(async () => {
  payload = await getTestPayload()
})

afterAll(async () => {
  for (const id of projectIds) {
    await payload.delete({ collection: 'project-submissions', id }).catch(() => {})
  }
  for (const id of trackIds) {
    await payload.delete({ collection: 'tracks', id }).catch(() => {})
  }
  for (const id of userIds) await cleanupUser(payload, id)
})

describe('Tracks: CRUD', () => {
  it('creates a track', async () => {
    const track = await payload.create({
      collection: 'tracks',
      data: {
        name: 'Space Track',
        slug: `space-track-${Date.now()}`,
        isActive: true,
        description: 'Focus on space tech',
        rulesetVersion: 'v1.0',
      },
    }) as any
    trackIds.push(track.id)

    expect(track.name).toBe('Space Track')
    expect(track.isActive).toBe(true)
    expect(track.rulesetVersion).toBe('v1.0')
  })

  it('track slug must be unique', async () => {
    const slug = `unique-track-${Date.now()}`
    const t1 = await payload.create({
      collection: 'tracks',
      data: { name: 'First Track', slug },
    }) as any
    trackIds.push(t1.id)

    await expect(
      payload.create({
        collection: 'tracks',
        data: { name: 'Dup Track', slug },
      })
    ).rejects.toThrow()
  })

  it('inactive track is stored correctly', async () => {
    const track = await payload.create({
      collection: 'tracks',
      data: {
        name: 'Retired Track',
        slug: `retired-track-${Date.now()}`,
        isActive: false,
      },
    }) as any
    trackIds.push(track.id)

    expect(track.isActive).toBe(false)
  })
})

describe('ProjectSubmissions: CRUD', () => {
  it('creates a project submission', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)

    const track = await payload.create({
      collection: 'tracks',
      data: { name: 'Test Track PS', slug: `ps-track-${Date.now()}` },
    }) as any
    trackIds.push(track.id)

    const ps = await payload.create({
      collection: 'project-submissions',
      data: {
        user: user.id,
        track: track.id,
        projectDescription: 'An AI-powered space farming platform',
        status: 'pending',
      },
    }) as any
    projectIds.push(ps.id)

    expect(ps.status).toBe('pending')
    expect(ps.projectDescription).toContain('space farming')
    expect(ps.autoDenied).toBe(false)
  })

  it('submission defaults to pending status', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)

    const ps = await payload.create({
      collection: 'project-submissions',
      data: {
        user: user.id,
        projectDescription: 'Simple project',
      },
    }) as any
    projectIds.push(ps.id)

    expect(ps.status).toBe('pending')
  })
})

describe('ProjectSubmissions: founder editing rules', () => {
  it('allows filling a missing workspace URL after approval without reopening the description', () => {
    expect(canFounderEditProjectSubmission({
      status: 'approved',
      projectDescription: 'Already reviewed project',
      workspaceUrl: null,
    })).toEqual({
      canEditDescription: false,
      canEditWorkspaceUrl: true,
    })
  })

  it('does not require project description when only the missing approved workspace URL can be edited', () => {
    expect(isProjectDescriptionRequiredForFounderSave({
      status: 'approved',
      projectDescription: '',
      workspaceUrl: null,
    })).toBe(false)
  })
})

describe('ProjectSubmissions: Status Transitions', () => {
  it('approve triggers space data analysis hook without requiring Next request scope', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)

    const ps = await payload.create({
      collection: 'project-submissions',
      data: {
        user: user.id,
        projectDescription: 'Approvable project',
        status: 'pending',
      },
    }) as any
    projectIds.push(ps.id)

    const updated = await payload.update({
      collection: 'project-submissions',
      id: ps.id,
      data: { status: 'approved', partnerComment: 'Great idea!' },
    }) as any

    expect(updated.status).toBe('approved')
  })

  it('admin can deny a submission', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)

    const ps = await payload.create({
      collection: 'project-submissions',
      data: {
        user: user.id,
        projectDescription: 'Deniable project',
        status: 'pending',
      },
    }) as any
    projectIds.push(ps.id)

    const updated = await payload.update({
      collection: 'project-submissions',
      id: ps.id,
      data: {
        status: 'denied',
        partnerComment: 'Outside our scope',
      },
    }) as any

    expect(updated.status).toBe('denied')
  })

  it('auto-denied flag is stored', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)

    const ps = await payload.create({
      collection: 'project-submissions',
      data: {
        user: user.id,
        projectDescription: 'Auto denied project',
        status: 'denied',
        autoDenied: true,
        bannedWordMatched: 'gambling',
      },
    }) as any
    projectIds.push(ps.id)

    expect(ps.autoDenied).toBe(true)
    expect(ps.bannedWordMatched).toBe('gambling')
  })
})

describe('ProjectSubmissions: Relationships', () => {
  it('submission links to track', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)

    const track = await payload.create({
      collection: 'tracks',
      data: { name: 'Linked Track', slug: `linked-track-${Date.now()}` },
    }) as any
    trackIds.push(track.id)

    const ps = await payload.create({
      collection: 'project-submissions',
      data: {
        user: user.id,
        track: track.id,
        projectDescription: 'Tracked project',
      },
    }) as any
    projectIds.push(ps.id)

    const fetched = await payload.findByID({
      collection: 'project-submissions',
      id: ps.id,
      depth: 0,
    }) as any

    expect(fetched.track).toBe(track.id)
    expect(fetched.user).toBe(user.id)
  })

  it('reviewer is tracked on denial', async () => {
    const { user: founder } = await createTestUser(payload, { role: 'founder' })
    const { user: admin } = await createTestUser(payload, { role: 'admin' })
    userIds.push(founder.id, admin.id)

    const ps = await payload.create({
      collection: 'project-submissions',
      data: {
        user: founder.id,
        projectDescription: 'Reviewed project',
        status: 'pending',
      },
    }) as any
    projectIds.push(ps.id)

    const updated = await payload.update({
      collection: 'project-submissions',
      id: ps.id,
      data: {
        status: 'denied',
        reviewedBy: admin.id,
        reviewedAt: new Date().toISOString(),
        partnerComment: 'Not a good fit',
      },
    }) as any

    const fetched = await payload.findByID({
      collection: 'project-submissions',
      id: updated.id,
      depth: 0,
    }) as any
    expect(fetched.reviewedBy).toBe(admin.id)
    expect(fetched.reviewedAt).toBeTruthy()
    expect(fetched.status).toBe('denied')
  })
})
