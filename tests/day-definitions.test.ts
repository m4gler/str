/**
 * Integration tests for DayDefinitions and form generation.
 * Tests curriculum import, day metadata, and generated forms.
 */
import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { getTestPayload } from './helpers'
import type { Payload } from 'payload'

let payload: Payload
const createdIds: (string | number)[] = []

beforeAll(async () => {
  payload = await getTestPayload()
})

afterAll(async () => {
  for (const id of createdIds) {
    await payload.delete({ collection: 'day-definitions', id }).catch(() => {})
  }
})

function countLinkedFormQuestions(linkedForm: any): number {
  if (!linkedForm || !Array.isArray(linkedForm.sections)) return 0
  return linkedForm.sections.reduce((total: number, section: any) => {
    return total + (Array.isArray(section?.questions) ? section.questions.length : 0)
  }, 0)
}

describe('DayDefinitions: CRUD', () => {
  it('creates a day definition with correct fields', async () => {
    const dd = await payload.create({
      collection: 'day-definitions',
      data: {
        title: 'Test Day 1',
        blockType: 'day',
        blockKey: `TEST-DAY-${Date.now()}`,
        dayNumber: 1,
        order: 1,
        theme: 'Ideation',
        deliverable: 'Business canvas',
        autoCheckCriteria: 'Canvas complete',
        questions: [
          {
            questionId: 'TD1-001',
            questionTitle: 'Mission briefing',
            questionType: 'statement',
            required: false,
            description: 'YOUR MISSION: Complete the canvas',
          },
          {
            questionId: 'TD1-002',
            questionTitle: 'Artifact link',
            questionType: 'website_url',
            required: true,
            description: 'Paste your link here',
          },
        ],
      },
    }) as any
    createdIds.push(dd.id)

    expect(dd.blockType).toBe('day')
    expect(dd.dayNumber).toBe(1)
    expect(dd.theme).toBe('Ideation')
    expect(dd.questions).toHaveLength(2)
    expect(dd.questions[0].questionType).toBe('statement')
    expect(dd.questions[0].required).toBe(false)
    expect(dd.questions[1].required).toBe(true)
  })

  it('creates prework definition', async () => {
    const dd = await payload.create({
      collection: 'day-definitions',
      data: {
        title: 'Prework 1',
        blockType: 'prework',
        blockKey: `TEST-PW-${Date.now()}`,
        dayNumber: 0,
        order: 1,
      },
    }) as any
    createdIds.push(dd.id)

    expect(dd.blockType).toBe('prework')
  })

  it('creates gate definition', async () => {
    const dd = await payload.create({
      collection: 'day-definitions',
      data: {
        title: 'Gate 15',
        blockType: 'gate',
        blockKey: `TEST-GATE-${Date.now()}`,
        dayNumber: 15,
        order: 15,
      },
    }) as any
    createdIds.push(dd.id)

    expect(dd.blockType).toBe('gate')
    expect(dd.dayNumber).toBe(15)
  })

  it('creates weekly retro definition', async () => {
    const dd = await payload.create({
      collection: 'day-definitions',
      data: {
        title: 'Week 1 Retro',
        blockType: 'weekly',
        blockKey: `TEST-WEEK-${Date.now()}`,
        dayNumber: 7,
        weekNumber: 1,
        order: 7,
      },
    }) as any
    createdIds.push(dd.id)

    expect(dd.blockType).toBe('weekly')
    expect(dd.weekNumber).toBe(1)
  })

  it('allows multiple variants for the same blockKey but rejects duplicate dimension keys', async () => {
    const key = `UNIQUE-KEY-${Date.now()}`
    const dd1 = await payload.create({
      collection: 'day-definitions',
      data: { title: 'First', blockType: 'day', blockKey: key, dayNumber: 1, order: 1, releaseKey: 'test-v1' },
    }) as any
    createdIds.push(dd1.id)

    const dd2 = await payload.create({
      collection: 'day-definitions',
      data: {
        title: 'Vertical Variant',
        blockType: 'day',
        blockKey: key,
        dayNumber: 1,
        order: 1,
        releaseKey: 'test-v1',
        definitionKind: 'override',
        vertical: 'Dual Use',
      },
    }) as any
    createdIds.push(dd2.id)

    expect(dd2.blockKey).toBe(key)
    expect(dd2.vertical).toBe('Dual Use')

    await expect(
      payload.create({
        collection: 'day-definitions',
        data: { title: 'Duplicate', blockType: 'day', blockKey: key, dayNumber: 2, order: 2, releaseKey: 'test-v1' },
      })
    ).rejects.toThrow()
  })
})

describe('DayDefinitions: Question Types', () => {
  it('all question types are accepted', async () => {
    const types = [
      'statement', 'short_text', 'long_text', 'email', 'website_url',
      'number', 'yes_no', 'multiple_choice', 'dropdown', 'opinion_scale', 'file_upload',
    ]

    const dd = await payload.create({
      collection: 'day-definitions',
      data: {
        title: 'All Types',
        blockType: 'day',
        blockKey: `TEST-TYPES-${Date.now()}`,
        dayNumber: 99,
        order: 99,
        questions: types.map((t, i) => ({
          questionId: `Q-${i}`,
          questionTitle: `Question ${t}`,
          questionType: t,
          required: t !== 'statement',
        })),
      },
    }) as any
    createdIds.push(dd.id)

    expect(dd.questions).toHaveLength(types.length)
    dd.questions.forEach((q: any, i: number) => {
      expect(q.questionType).toBe(types[i])
    })
  })
})

describe('DayDefinitions: Existing Data', () => {
  it('DAY-BLOCK-1 resolves through a linked form with imported questions', async () => {
    const found = await payload.find({
      collection: 'day-definitions',
      where: {
        blockKey: { equals: 'DAY-BLOCK-1' },
        vertical: { equals: 'General' },
        personality: { equals: 'General' },
        track: { equals: 'General' },
      },
      limit: 1,
      depth: 2,
    })

    expect(found.totalDocs).toBeGreaterThan(0)

    const dd = found.docs[0] as any
    expect(dd.blockType).toBe('day')
    expect(dd.dayNumber).toBe(1)
    expect(dd.linkedForm).toBeTruthy()
    expect(Array.isArray(dd.linkedForm.sections)).toBe(true)
    expect(countLinkedFormQuestions(dd.linkedForm)).toBeGreaterThan(0)
  })

  it('active release contains 100 imported base day blocks', async () => {
    const dayProgram = await payload.findGlobal({ slug: 'day-program' }).catch(() => null) as any
    const activeReleaseKey = String(dayProgram?.activeCurriculumReleaseKey || '').trim()
    const all = await payload.find({
      collection: 'day-definitions',
      where: {
        and: [
          { blockType: { equals: 'day' } },
          { definitionKind: { equals: 'base' } },
          ...(activeReleaseKey ? [{ releaseKey: { equals: activeReleaseKey } }] : []),
        ],
      },
      limit: 250,
      depth: 1,
    })

    expect(all.docs).toHaveLength(100)
  })

  it('imported base day blocks use linked forms as the current submission contract', async () => {
    const dayProgram = await payload.findGlobal({ slug: 'day-program' }).catch(() => null) as any
    const activeReleaseKey = String(dayProgram?.activeCurriculumReleaseKey || '').trim()
    const all = await payload.find({
      collection: 'day-definitions',
      where: {
        and: [
          { blockType: { equals: 'day' } },
          { definitionKind: { equals: 'base' } },
          ...(activeReleaseKey ? [{ releaseKey: { equals: activeReleaseKey } }] : []),
        ],
      },
      limit: 250,
      depth: 2,
    })

    const linkedForms = (all.docs as any[]).map((dd) => dd.linkedForm).filter(Boolean)

    expect(linkedForms).toHaveLength(100)
    expect(linkedForms.every((linkedForm) => countLinkedFormQuestions(linkedForm) > 0)).toBe(true)
  })
})
