/**
 * Integration tests for EcosystemItems and IntroRequests collections.
 * Tests CRUD, status transitions, and access patterns.
 */
import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { getTestPayload, createTestUser, cleanupUser } from './helpers'
import type { Payload } from 'payload'

let payload: Payload
const userIds: (string | number)[] = []
const ecoIds: (string | number)[] = []
const introIds: (string | number)[] = []

beforeAll(async () => {
  payload = await getTestPayload()
})

afterAll(async () => {
  for (const id of introIds) {
    await payload.delete({ collection: 'intro-requests', id }).catch(() => {})
  }
  for (const id of ecoIds) {
    await payload.delete({ collection: 'ecosystem-items', id }).catch(() => {})
  }
  for (const id of userIds) await cleanupUser(payload, id)
})

// ── EcosystemItems ──

describe('EcosystemItems: CRUD', () => {
  it('creates an ecosystem item', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)

    const item = await payload.create({
      collection: 'ecosystem-items',
      data: {
        user: user.id,
        itemType: 'online_group',
        name: 'Startup Warsaw Slack',
        description: 'Active startup community in Warsaw',
        url: 'https://slack.example.com/startup-warsaw',
        status: 'identified',
        priority: 'high',
      },
    }) as any
    ecoIds.push(item.id)

    expect(item.itemType).toBe('online_group')
    expect(item.name).toBe('Startup Warsaw Slack')
    expect(item.status).toBe('identified')
    expect(item.priority).toBe('high')
  })

  it('all item types are accepted', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)

    const types = ['online_group', 'physical_place', 'event', 'angel_vc', 'operator', 'signal_account']
    for (const itemType of types) {
      const item = await payload.create({
        collection: 'ecosystem-items',
        data: {
          user: user.id,
          itemType,
          name: `Test ${itemType}`,
        },
      }) as any
      ecoIds.push(item.id)
      expect(item.itemType).toBe(itemType)
    }
  })

  it('status transitions work', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)

    const item = await payload.create({
      collection: 'ecosystem-items',
      data: {
        user: user.id,
        itemType: 'angel_vc',
        name: 'Test VC Fund',
        status: 'identified',
      },
    }) as any
    ecoIds.push(item.id)

    const statuses = ['contacted', 'engaged', 'active', 'archived']
    for (const status of statuses) {
      const updated = await payload.update({
        collection: 'ecosystem-items',
        id: item.id,
        data: { status },
      }) as any
      expect(updated.status).toBe(status)
    }
  })

  it('event type with date and location', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)

    const item = await payload.create({
      collection: 'ecosystem-items',
      data: {
        user: user.id,
        itemType: 'event',
        name: 'Startup Weekend Warsaw',
        eventDate: '2026-05-15T09:00:00.000Z',
        location: {
          city: 'Warsaw',
          country: 'Poland',
          lat: 52.2297,
          lng: 21.0122,
        },
      },
    }) as any
    ecoIds.push(item.id)

    expect(item.eventDate).toBeTruthy()
    expect(item.location.city).toBe('Warsaw')
  })

  it('priority levels', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)

    for (const priority of ['high', 'medium', 'low']) {
      const item = await payload.create({
        collection: 'ecosystem-items',
        data: {
          user: user.id,
          itemType: 'operator',
          name: `Priority ${priority}`,
          priority,
        },
      }) as any
      ecoIds.push(item.id)
      expect(item.priority).toBe(priority)
    }
  })
})

// ── IntroRequests ──

describe('IntroRequests: CRUD', () => {
  it('creates an intro request', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)

    const intro = await payload.create({
      collection: 'intro-requests',
      data: {
        user: user.id,
        targetName: 'John Investor',
        targetRole: 'Angel Investor',
        targetOrganization: 'VC Fund Poland',
        targetUrl: 'https://linkedin.com/in/johninvestor',
        reason: 'Looking for seed funding for my space-tech startup',
        status: 'requested',
      },
    }) as any
    introIds.push(intro.id)

    expect(intro.targetName).toBe('John Investor')
    expect(intro.status).toBe('requested')
    expect(intro.reason).toContain('seed funding')
  })

  it('defaults to requested status', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)

    const intro = await payload.create({
      collection: 'intro-requests',
      data: {
        user: user.id,
        targetName: 'Default Status Test',
        reason: 'Testing defaults',
      },
    }) as any
    introIds.push(intro.id)

    expect(intro.status).toBe('requested')
  })
})

describe('IntroRequests: Status Transitions', () => {
  it('requested → in_progress → completed', async () => {
    const { user } = await createTestUser(payload)
    const { user: admin } = await createTestUser(payload, { role: 'admin' })
    userIds.push(user.id, admin.id)

    const intro = await payload.create({
      collection: 'intro-requests',
      data: {
        user: user.id,
        targetName: 'Lifecycle Test',
        reason: 'Full lifecycle',
      },
    }) as any
    introIds.push(intro.id)

    // Move to in_progress
    const inProgress = await payload.update({
      collection: 'intro-requests',
      id: intro.id,
      data: {
        status: 'in_progress',
        assignedTo: admin.id,
        adminNotes: 'Reaching out via email',
      },
    }) as any
    expect(inProgress.status).toBe('in_progress')

    // Complete
    const completed = await payload.update({
      collection: 'intro-requests',
      id: intro.id,
      data: {
        status: 'completed',
        completedAt: new Date().toISOString(),
        adminNotes: 'Intro email sent, both parties connected',
      },
    }) as any
    expect(completed.status).toBe('completed')
    expect(completed.completedAt).toBeTruthy()
  })

  it('declined with reason', async () => {
    const { user } = await createTestUser(payload)
    userIds.push(user.id)

    const intro = await payload.create({
      collection: 'intro-requests',
      data: {
        user: user.id,
        targetName: 'Decline Test',
        reason: 'To be declined',
      },
    }) as any
    introIds.push(intro.id)

    const declined = await payload.update({
      collection: 'intro-requests',
      id: intro.id,
      data: {
        status: 'declined',
        declineReason: 'Target contact unavailable at this time',
      },
    }) as any
    expect(declined.status).toBe('declined')
    expect(declined.declineReason).toContain('unavailable')
  })
})
