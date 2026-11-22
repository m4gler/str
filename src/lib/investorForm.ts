import type { InvestorForm } from '@/payload-types'
import {
  CANONICAL_ARCHETYPES,
  normalizeArchetypeKey,
} from '@/lib/curriculum/constants'

type InvestorSection = NonNullable<InvestorForm['sections']>[number]
type InvestorQuestion = NonNullable<InvestorSection['questions']>[number]
type InvestorChoice = NonNullable<InvestorQuestion['choices']>[number]

/**
 * Country list fallback — used only when the Payload document has no choices
 * for I1_COUNTRY (e.g. before the seed has been run).
 */
const COUNTRY_CODE_BLACKLIST = new Set([
  'AC', 'AN', 'BU', 'CP', 'CQ', 'DG', 'EA', 'EU', 'EZ', 'FX',
  'IC', 'QO', 'TA', 'UN', 'XA', 'XB', 'ZZ',
])

function buildCountryChoices(): InvestorChoice[] {
  const displayNames = new Intl.DisplayNames(['en'], { type: 'region' })
  const seenLabels = new Set<string>()
  const choices: InvestorChoice[] = []

  for (let first = 65; first <= 90; first++) {
    for (let second = 65; second <= 90; second++) {
      const code = String.fromCharCode(first) + String.fromCharCode(second)
      if (COUNTRY_CODE_BLACKLIST.has(code)) continue

      const label = displayNames.of(code)
      if (!label || label === code || /pseudo|unknown region/i.test(label)) continue
      if (seenLabels.has(label)) continue

      seenLabels.add(label)
      choices.push({ label, value: label })
    }
  }

  return choices.sort((left, right) => left.label.localeCompare(right.label, 'en'))
}

export const INVESTOR_COUNTRY_CHOICES = buildCountryChoices()

/**
 * Lightweight normalization pass over the Payload investor form.
 *
 * The Payload document (seeded via POST /api/seed-investor-form) is the
 * single source of truth for question texts, choices, helper texts, etc.
 *
 * This function only handles two things that can't live in Payload:
 * 1. Archetype choices — kept in sync with CANONICAL_ARCHETYPES constant
 *    (cross-cutting data used across the platform)
 * 2. Country list fallback — if the Payload doc has no choices for I1_COUNTRY,
 *    populate from the Intl API so the form is still usable before seeding
 */
function normalizeQuestion(question: InvestorQuestion): InvestorQuestion {
  switch (question.question_id) {
    case 'I1_COUNTRY':
      if (!question.choices || question.choices.length === 0) {
        return {
          ...question,
          choices: INVESTOR_COUNTRY_CHOICES,
          placeholder: question.placeholder || 'Select your country',
        }
      }
      return question

    case 'I8_ARCHETYPE_FIT':
      return {
        ...question,
        choices: CANONICAL_ARCHETYPES.map((archetype) => ({
          label: `${archetype.key} — ${archetype.tagline}`,
          value: archetype.key,
        })),
      }

    default:
      return question
  }
}

export function normalizeInvestorFormConfig(form: InvestorForm | null): InvestorForm | null {
  if (!form?.sections) return form

  const sections = form.sections
    .map((section) => ({
      ...section,
      questions: (section.questions || [])
        .map((question) => normalizeQuestion(question)),
    }))
    .filter((section) => (section.questions?.length || 0) > 0)

  return {
    ...form,
    sections,
  }
}

export function normalizeInvestorStoredAnswer(questionId: string, value: unknown) {
  if (questionId !== 'I8_ARCHETYPE_FIT') {
    return value
  }

  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => normalizeArchetypeKey(String(item || '')))
      .filter(Boolean)

    return Array.from(new Set(normalized))
  }

  if (typeof value === 'string') {
    return normalizeArchetypeKey(value)
  }

  return value
}
