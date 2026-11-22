import { describe, expect, it } from 'vitest'
import { makePreworkSectionsOptional } from '@/components/FounderForm/preworkRequirements'
import type { Section } from '@/components/FounderForm/types'

const sections: Section[] = [
  {
    id: 'deliverable',
    title: 'Deliverable',
    questions: [
      {
        question_id: 'artifact_link',
        question_text: 'Artifact link (Doc/Sheet/Figma/Drive)',
        question_type: 'url',
        required: true,
      },
      {
        question_id: 'summary',
        question_text: 'Summary Note',
        question_type: 'long_text',
        required: true,
      },
    ],
  },
]

describe('prework requirements', () => {
  it('turns every prework question optional', () => {
    const result = makePreworkSectionsOptional(sections, true)

    expect(result[0].questions.every((question) => question.required === false)).toBe(true)
  })

  it('leaves non-prework requirements unchanged', () => {
    const result = makePreworkSectionsOptional(sections, false)

    expect(result).toBe(sections)
    expect(result[0].questions[0].required).toBe(true)
  })
})
