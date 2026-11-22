import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import {
  resolveCurriculumContext,
  resolveDayDefinitionByBlockKey,
} from '@/lib/curriculum/resolve'

function buildPayloadMock(dayDefinitions: any[] = []) {
  return {
    findGlobal: vi.fn(async ({ slug }: { slug: string }) => {
      if (slug === 'day-program') {
        return {
          activeCurriculumReleaseKey: 'v-test',
        }
      }
      return null
    }),
    find: vi.fn(async ({ collection }: { collection: string }) => {
      if (collection === 'day-definitions') {
        return {
          docs: dayDefinitions,
          totalDocs: dayDefinitions.length,
        }
      }

      return {
        docs: [],
        totalDocs: 0,
      }
    }),
  } as unknown as Payload
}

function buildDefinitionPool() {
  return [
    {
      id: 1,
      blockKey: 'DAY-BLOCK-1',
      definitionKind: 'base',
      releaseKey: 'v-test',
      vertical: 'General',
      personality: 'General',
      track: 'General',
      title: 'Day 1',
      blockType: 'day',
      dayNumber: 1,
      deliverable: 'base deliverable',
      coachingNote: 'base coaching',
      mesgaIntegration: 'base tool',
      sourceSheet: 'GENERAL',
      sourceRowNumber: 2,
    },
    {
      id: 2,
      blockKey: 'DAY-BLOCK-1',
      definitionKind: 'override',
      releaseKey: 'v-test',
      vertical: 'Dual Use',
      personality: 'General',
      track: 'General',
      deliverable: 'vertical deliverable',
      mesgaIntegration: 'vertical tool',
      sourceSheet: 'DUAL USE',
      sourceRowNumber: 2,
    },
    {
      id: 3,
      blockKey: 'DAY-BLOCK-1',
      definitionKind: 'override',
      releaseKey: 'v-test',
      vertical: 'General',
      personality: 'Guardian',
      track: 'General',
      coachingNote: 'guardian coaching',
      sourceSheet: 'PERSONALITY GUIDE',
      sourceRowNumber: 2,
    },
    {
      id: 4,
      blockKey: 'DAY-BLOCK-1',
      definitionKind: 'override',
      releaseKey: 'v-test',
      vertical: 'General',
      personality: 'General',
      track: 'Operator Track',
      mesgaIntegration: 'operator tool',
      sourceSheet: 'TRACK GUIDE',
      sourceRowNumber: 2,
    },
    {
      id: 5,
      blockKey: 'DAY-BLOCK-1',
      definitionKind: 'override',
      releaseKey: 'v-test',
      vertical: 'Dual Use',
      personality: 'Guardian',
      track: 'Operator Track',
      deliverable: 'combo deliverable',
      coachingNote: 'combo coaching',
      mesgaIntegration: 'combo tool',
      sourceSheet: 'TRACK GUIDE',
      sourceRowNumber: 3,
    },
  ]
}

describe('Curriculum resolve', () => {
  it('derives vertical from an explicit track-like value', async () => {
    const payload = buildPayloadMock()

    const context = await resolveCurriculumContext(payload, {
      track: 'dual-use',
    })

    expect(context).toEqual({
      releaseKey: 'v-test',
      vertical: 'Dual Use',
      personality: 'General',
      track: 'dual-use',
    })
  })

  it('merges the most specific vertical/personality/track override', async () => {
    const payload = buildPayloadMock(buildDefinitionPool())

    const resolved = await resolveDayDefinitionByBlockKey(payload, 'DAY-BLOCK-1', {
      vertical: 'Dual Use',
      personality: 'Guardian',
      track: 'Operator Track',
    })

    expect(resolved).toMatchObject({
      title: 'Day 1',
      blockKey: 'DAY-BLOCK-1',
      deliverable: 'combo deliverable',
      coachingNote: 'combo coaching',
      mesgaIntegration: 'combo tool',
      vertical: 'Dual Use',
      personality: 'Guardian',
      track: 'Operator Track',
    })
  })

  it('uses track-to-vertical mapping when only the track is provided', async () => {
    const payload = buildPayloadMock(buildDefinitionPool())

    const resolved = await resolveDayDefinitionByBlockKey(payload, 'DAY-BLOCK-1', {
      track: 'dual-use',
    })

    expect(resolved).toMatchObject({
      deliverable: 'vertical deliverable',
      mesgaIntegration: 'vertical tool',
      vertical: 'Dual Use',
      personality: 'General',
      track: 'dual-use',
    })
  })
})
