import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  getAppUrl: vi.fn(() => 'https://mesga.example'),
  notifyMentorReviewComplete: vi.fn(),
  notifyProjectSubmissionCreatedAlert: vi.fn(),
  notifyProjectSubmissionDecision: vi.fn(),
}))

vi.mock('next/server', () => ({
  after: mocks.after,
}))

vi.mock('@/lib/appUrl', () => ({
  getAppUrl: mocks.getAppUrl,
}))

vi.mock('@/lib/copernicus', () => ({
  analyzeSpaceDataRelevance: vi.fn(),
  buildSpaceDataConfig: vi.fn(() => ({})),
}))

vi.mock('@/lib/notifications', () => ({
  notifyMentorReviewComplete: mocks.notifyMentorReviewComplete,
  notifyProjectSubmissionCreatedAlert: mocks.notifyProjectSubmissionCreatedAlert,
  notifyProjectSubmissionDecision: mocks.notifyProjectSubmissionDecision,
}))

import { ProjectSubmissions } from '@/collections/ProjectSubmissions'
import { mentorReviewNotificationAfterChange } from '@/hooks/mentorReviewNotificationHook'

describe('Review notification hooks', () => {
  beforeEach(() => {
    mocks.after.mockReset()
    mocks.getAppUrl.mockReset()
    mocks.getAppUrl.mockReturnValue('https://mesga.example')
    mocks.notifyMentorReviewComplete.mockReset()
    mocks.notifyProjectSubmissionCreatedAlert.mockReset()
    mocks.notifyProjectSubmissionDecision.mockReset()
  })

  it('emails the founder when a non-gate mentor review is created', async () => {
    const findByIDMock = vi.fn(async ({ collection, id }: { collection: string; id: string | number }) => {
      if (collection === 'founder-form-submissions' && Number(id) === 77) {
        return {
          id: 77,
          programDay: 12,
          user: {
            id: 501,
            email: 'founder@example.com',
          },
        }
      }

      if (collection === 'users' && Number(id) === 91) {
        return {
          id: 91,
          email: 'mentor@example.com',
        }
      }

      return null
    })

    const doc = await mentorReviewNotificationAfterChange({
      doc: {
        id: 301,
        submission: 77,
        reviewer: 91,
        dayNumber: 12,
        score: 4,
        isGateReview: false,
      },
      req: {
        payload: {
          findByID: findByIDMock,
        },
      },
      operation: 'create',
    } as any)

    expect(doc.id).toBe(301)
    expect(mocks.notifyMentorReviewComplete).toHaveBeenCalledTimes(1)
    expect(mocks.notifyMentorReviewComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        findByID: findByIDMock,
      }),
      {
        email: 'founder@example.com',
        name: 'founder@example.com',
      },
      'mentor@example.com',
      12,
      4,
      'https://mesga.example',
    )
  })

  it('skips the standard founder email for gate reviews', async () => {
    await mentorReviewNotificationAfterChange({
      doc: {
        id: 401,
        submission: 88,
        reviewer: 92,
        dayNumber: 15,
        score: 5,
        isGateReview: true,
      },
      req: {
        payload: {
          findByID: vi.fn(),
        },
      },
      operation: 'create',
    } as any)

    expect(mocks.notifyMentorReviewComplete).not.toHaveBeenCalled()
  })

  it('sends project denial emails inline from the project submission hook', async () => {
    const afterChangeHook = ProjectSubmissions.hooks?.afterChange?.[0]
    expect(afterChangeHook).toBeTypeOf('function')

    const findByIDMock = vi.fn(async ({ collection, id }: { collection: string; id: string | number }) => {
      if (collection === 'users' && Number(id) === 21) {
        return {
          id: 21,
          email: 'founder@example.com',
        }
      }

      if (collection === 'tracks' && Number(id) === 7) {
        return {
          id: 7,
          name: 'Space',
        }
      }

      return null
    })

    await afterChangeHook?.({
      doc: {
        id: 501,
        user: 21,
        track: 7,
        status: 'denied',
        projectDescription: 'Satellite workflow tooling',
        partnerComment: 'Needs a clearer wedge.',
      },
      previousDoc: {
        status: 'pending',
        projectDescription: 'Satellite workflow tooling',
      },
      req: {
        payload: {
          findByID: findByIDMock,
        },
      },
    } as any)

    expect(mocks.notifyProjectSubmissionDecision).toHaveBeenCalledTimes(1)
    expect(mocks.notifyProjectSubmissionDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        findByID: findByIDMock,
      }),
      {
        email: 'founder@example.com',
        name: 'founder@example.com',
      },
      'denied',
      'https://mesga.example',
      {
        comment: 'Needs a clearer wedge.',
        trackName: 'Space',
      },
    )
    expect(mocks.after).not.toHaveBeenCalled()
  })
})
