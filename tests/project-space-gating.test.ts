import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  analyzeSpaceDataRelevance: vi.fn(),
}))

vi.mock('next/server', () => ({
  after: mocks.after,
}))

vi.mock('@/lib/copernicus', () => ({
  analyzeSpaceDataRelevance: mocks.analyzeSpaceDataRelevance,
  buildSpaceDataConfig: vi.fn(() => ({})),
}))

vi.mock('@/lib/notifications', () => ({
  notifyProjectSubmissionCreatedAlert: vi.fn(),
  notifyProjectSubmissionDecision: vi.fn(),
}))

import { ProjectSubmissions } from '@/collections/ProjectSubmissions'

const afterChangeHook = ProjectSubmissions.hooks?.afterChange?.[0]

function createPayload(trackSlugs: Record<number, string>) {
  return {
    findByID: vi.fn(async ({ collection, id }: { collection: string; id: number }) => {
      if (collection === 'tracks') {
        const slug = trackSlugs[Number(id)]
        return slug ? { id, slug } : null
      }
      return null
    }),
    update: vi.fn(async () => ({})),
  }
}

describe('project submission space-data gating', () => {
  beforeEach(() => {
    mocks.after.mockReset()
    mocks.analyzeSpaceDataRelevance.mockReset()
  })

  it('does not schedule analysis for General and removes a stale result', async () => {
    const payload = createPayload({ 1: 'general' })

    await afterChangeHook?.({
      doc: {
        id: 10,
        user: 20,
        track: 1,
        status: 'pending',
        projectDescription: 'Updated general project',
        spaceDataRelevance: { relevanceScore: 42 },
      },
      previousDoc: {
        track: 1,
        status: 'pending',
        projectDescription: 'Original general project',
        spaceDataRelevance: { relevanceScore: 42 },
      },
      req: { payload },
      operation: 'update',
    } as any)

    expect(mocks.after).not.toHaveBeenCalled()
    expect(payload.update).toHaveBeenCalledWith({
      collection: 'project-submissions',
      id: 10,
      data: { spaceDataRelevance: null },
    })
  })

  it('schedules analysis when an existing description moves from General to Space', async () => {
    const payload = createPayload({ 1: 'general', 2: 'satc' })

    await afterChangeHook?.({
      doc: {
        id: 11,
        user: 21,
        track: 2,
        status: 'pending',
        projectDescription: 'The same project description',
        spaceDataRelevance: null,
      },
      previousDoc: {
        track: 1,
        status: 'pending',
        projectDescription: 'The same project description',
        spaceDataRelevance: null,
      },
      req: { payload },
      operation: 'update',
    } as any)

    expect(mocks.after).toHaveBeenCalledTimes(1)
  })

  it('re-checks the track before a queued analysis starts', async () => {
    const payload = createPayload({ 1: 'general', 2: 'satc' })

    await afterChangeHook?.({
      doc: {
        id: 12,
        user: 22,
        track: 2,
        status: 'pending',
        projectDescription: 'Space project description',
        spaceDataRelevance: null,
      },
      previousDoc: {
        track: 1,
        status: 'pending',
        projectDescription: 'Space project description',
        spaceDataRelevance: null,
      },
      req: { payload },
      operation: 'update',
    } as any)

    const queuedTask = mocks.after.mock.calls[0]?.[0] as (() => Promise<void>) | undefined
    expect(queuedTask).toBeTypeOf('function')

    payload.findByID.mockImplementation(async ({ collection, id }: { collection: string; id: number }) => {
      if (collection === 'project-submissions') {
        return {
          id,
          user: 22,
          track: { id: 1, slug: 'general' },
          projectDescription: 'Space project description',
        }
      }
      if (collection === 'tracks') {
        const slug = ({ 1: 'general', 2: 'satc' } as Record<number, string>)[Number(id)]
        return slug ? { id, slug } : null
      }
      return null
    })

    await queuedTask?.()

    expect(mocks.analyzeSpaceDataRelevance).not.toHaveBeenCalled()
  })

  it('hides the REST field from a General founder and allows it for a Space founder', async () => {
    const field = ProjectSubmissions.fields.find(
      (candidate) => 'name' in candidate && candidate.name === 'spaceDataRelevance',
    ) as any
    const canRead = field.access?.read
    const payload = createPayload({ 1: 'general', 2: 'satc' })

    await expect(canRead({
      req: { user: { id: 20, role: 'founder' }, payload },
      doc: { track: 1 },
    })).resolves.toBe(false)
    await expect(canRead({
      req: { user: { id: 21, role: 'founder' }, payload },
      doc: { track: 2 },
    })).resolves.toBe(true)
    await expect(canRead({
      req: { user: { id: 22, role: 'founder' }, payload },
      doc: { track: { id: 2, slug: 'satc', isActive: false } },
    })).resolves.toBe(false)
  })
})
