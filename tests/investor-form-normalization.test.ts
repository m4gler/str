import { describe, expect, it } from 'vitest'
import type { InvestorForm } from '@/payload-types'
import {
  normalizeInvestorFormConfig,
  normalizeInvestorStoredAnswer,
} from '@/lib/investorForm'

function buildForm(): InvestorForm {
  return {
    id: 1,
    title: 'Investor Intake Form',
    slug: 'investor-intake-v1',
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    allowMultipleSubmissions: false,
    sections: [
      {
        id: 'section-a',
        title: 'Basics',
        questions: [
          {
            id: 'question-country',
            question_id: 'I1_COUNTRY',
            question_text: 'Country of residence',
            question_type: 'dropdown',
            required: true,
            choices: [], // empty — fallback should kick in
          },
        ],
      },
      {
        id: 'section-b',
        title: 'Matching',
        questions: [
          {
            id: 'question-archetype',
            question_id: 'I8_ARCHETYPE_FIT',
            question_text: 'Which founder archetypes do you work best with?',
            question_type: 'multiple_choice_multiple',
            required: false,
            helperText: 'Pick the founder working styles you support best.',
            choices: [
              { id: 'choice-builder', label: 'Builder', value: 'Builder' },
              { id: 'choice-general', label: 'The General (Balanced Builder)', value: 'The General (Balanced Builder)' },
            ],
          },
        ],
      },
    ],
  } as InvestorForm
}

describe('normalizeInvestorFormConfig', () => {
  it('injects country choices when Payload doc has empty choices', () => {
    const normalized = normalizeInvestorFormConfig(buildForm())
    const questions = normalized?.sections?.flatMap((section: any) => section.questions || []) || []

    const countryQuestion = questions.find((question: any) => question.question_id === 'I1_COUNTRY')
    expect(countryQuestion?.choices?.length).toBeGreaterThan(50)
  })

  it('preserves country choices from Payload when present', () => {
    const form = buildForm()
    const countryQ = form.sections![0].questions![0]
    countryQ.choices = [
      { label: 'Poland', value: 'Poland' },
      { label: 'Germany', value: 'Germany' },
    ]

    const normalized = normalizeInvestorFormConfig(form)
    const questions = normalized?.sections?.flatMap((s: any) => s.questions || []) || []
    const countryQuestion = questions.find((q: any) => q.question_id === 'I1_COUNTRY')
    expect(countryQuestion?.choices?.length).toBe(2)
    expect(countryQuestion?.choices?.[0].label).toBe('Poland')
  })

  it('replaces archetypes with canonical labels and descriptions', () => {
    const normalized = normalizeInvestorFormConfig(buildForm())
    const questions = normalized?.sections?.flatMap((section: any) => section.questions || []) || []
    const archetypeQuestion = questions.find((question: any) => question.question_id === 'I8_ARCHETYPE_FIT')

    expect(archetypeQuestion?.choices?.some((choice) => choice.label.includes('Builder'))).toBe(true)
    expect(archetypeQuestion?.choices?.some((choice) => choice.label.includes('Ship It, Fix It, Ship Again'))).toBe(true)
  })

  it('passes through other questions unchanged', () => {
    const form = buildForm()
    form.sections![0].questions!.push({
      id: 'q-other',
      question_id: 'I3_RESTRICTIONS',
      question_text: 'Any hard restrictions or conflicts?',
      question_type: 'long_text',
      required: false,
      helperText: 'Use short keywords or a short sentence if needed.',
      placeholder: 'Leave blank if none',
    } as any)

    const normalized = normalizeInvestorFormConfig(form)
    const questions = normalized?.sections?.flatMap((s: any) => s.questions || []) || []
    const restrictions = questions.find((q: any) => q.question_id === 'I3_RESTRICTIONS')
    expect(restrictions?.helperText).toBe('Use short keywords or a short sentence if needed.')
    expect(restrictions?.placeholder).toBe('Leave blank if none')
  })
})

describe('normalizeInvestorStoredAnswer', () => {
  it('maps legacy archetype values to canonical ones', () => {
    expect(normalizeInvestorStoredAnswer('I8_ARCHETYPE_FIT', ['Bob the Beaver', 'The General'])).toEqual([
      'Builder',
      'Anchor',
    ])
  })

  it('passes through non-archetype answers unchanged', () => {
    expect(normalizeInvestorStoredAnswer('I5_SECTOR_FOCUS', ['Software & Data'])).toEqual([
      'Software & Data',
    ])
  })
})
