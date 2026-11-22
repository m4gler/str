import { describe, expect, it } from 'vitest'
import { buildFounderAnalytics } from '@/lib/adminFounderAnalytics'

describe('admin founder analytics', () => {
  it('exposes admin links for completed founder steps and daily submissions', () => {
    const analytics = buildFounderAnalytics({
      users: [
        {
          id: 10,
          role: 'founder',
          email: 'founder@example.com',
          createdAt: '2026-05-01T00:00:00.000Z',
          programStatus: 'active',
        },
      ],
      submissions: [
        {
          id: 101,
          user: 10,
          form: 1,
          createdAt: '2026-05-02T00:00:00.000Z',
          submissionData: {},
        },
        {
          id: 102,
          user: 10,
          form: 2,
          createdAt: '2026-05-03T00:00:00.000Z',
          archetype: 'Builder',
          personalityScores: { archetypeEmoji: 'B' },
          track: 'Operator Track',
        },
        {
          id: 103,
          user: 10,
          form: 3,
          programDay: 1,
          createdAt: '2026-05-04T00:00:00.000Z',
        },
      ],
      projectSubmissions: [
        {
          id: 201,
          user: 10,
          status: 'approved',
          createdAt: '2026-05-05T00:00:00.000Z',
        },
      ],
      attempts: [
        {
          id: 301,
          user: 10,
          status: 'active',
          currentDay: 2,
          createdAt: '2026-05-06T00:00:00.000Z',
          updatedAt: '2026-05-06T00:00:00.000Z',
        },
      ],
      partners: [],
      tracks: [],
      settings: { personality: { archetypes: [] } },
      activePersonalityTestFormId: '2',
    })

    expect(analytics.rows[0].stepLinks).toMatchObject({
      registered: '/admin/collections/users/10',
      intake: '/admin/collections/founder-form-submissions/101',
      personality: '/admin/collections/founder-form-submissions/102',
      project: '/admin/collections/project-submissions/201',
      started100Days: '/admin/collections/attempts/301',
      active100Days: '/admin/collections/attempts/301',
    })
    expect(analytics.rows[0].daySubmissionIds[1]).toBe('103')
  })
})
