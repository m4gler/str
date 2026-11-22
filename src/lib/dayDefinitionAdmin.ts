import { DEFAULT_PROGRAM_CONFIG } from '@/lib/attemptEngine'

export type AdminQuestionSummary = {
  questionId: string
  questionTitle: string
  questionType: string
  required: boolean
  description: string
}

export type AdminFounderForm = {
  id: number | string
  title: string
  slug: string
  questions: AdminQuestionSummary[]
}

export type AdminDayProgramConfig = {
  activeCurriculumReleaseKey: string | null
  gateDays: number[]
  retroEveryNDays: number
}

export type ResolvedQuestionSource = 'linked_form' | 'linked_form_missing' | 'legacy' | 'none'
export type DerivedProgramKind = 'standard' | 'gate' | 'weekly' | 'prework'

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export function normalizeDayProgramConfig(dayProgram: any): AdminDayProgramConfig {
  const gateDays = Array.isArray(dayProgram?.gateDays)
    ? dayProgram.gateDays
        .map((value: unknown) => toFiniteNumber(value))
        .filter((value: number | null): value is number => value != null)
    : DEFAULT_PROGRAM_CONFIG.gateDays

  const retroEveryNDays = Math.max(
    1,
    toFiniteNumber(dayProgram?.retroEveryNDays) ?? DEFAULT_PROGRAM_CONFIG.retroEveryNDays,
  )

  const activeCurriculumReleaseKey = String(dayProgram?.activeCurriculumReleaseKey || '').trim() || null

  return {
    activeCurriculumReleaseKey,
    gateDays,
    retroEveryNDays,
  }
}

export function filterToActiveRelease<T extends { releaseKey?: string | null }>(
  definitions: T[],
  activeReleaseKey: string | null,
): T[] {
  if (!activeReleaseKey) return definitions

  const matchingDefinitions = definitions.filter((definition) => String(definition.releaseKey || '').trim() === activeReleaseKey)
  return matchingDefinitions.length > 0 ? matchingDefinitions : definitions
}

export function flattenFounderFormQuestions(form: any): AdminQuestionSummary[] {
  if (!form || !Array.isArray(form.sections)) return []

  return form.sections.flatMap((section: any) => {
    if (!Array.isArray(section?.questions)) return []

    return section.questions.map((question: any) => ({
      questionId: String(question?.question_id || '').trim(),
      questionTitle: String(question?.question_text || '').trim(),
      questionType: String(question?.question_type || '').trim(),
      required: Boolean(question?.required),
      description: String(question?.helperText || '').trim(),
    }))
  })
}

export function mapFounderFormSummary(form: any): AdminFounderForm {
  return {
    id: form.id,
    title: String(form.title || ''),
    slug: String(form.slug || ''),
    questions: flattenFounderFormQuestions(form),
  }
}

function mapLegacyQuestion(question: any): AdminQuestionSummary {
  return {
    questionId: String(question?.questionId || '').trim(),
    questionTitle: String(question?.questionTitle || '').trim(),
    questionType: String(question?.questionType || '').trim() || 'short_text',
    required: Boolean(question?.required),
    description: String(question?.description || '').trim(),
  }
}

export function buildFounderFormLookup(forms: AdminFounderForm[]): Map<string, AdminFounderForm> {
  return new Map(forms.map((form) => [String(form.id), form]))
}

export function resolveDefinitionQuestions(
  definition: { linkedForm?: number | string | null; questions?: unknown[] },
  formLookup: Map<string, AdminFounderForm>,
): {
  source: ResolvedQuestionSource
  questions: AdminQuestionSummary[]
  linkedForm: AdminFounderForm | null
} {
  if (definition.linkedForm != null && definition.linkedForm !== '') {
    const linkedForm = formLookup.get(String(definition.linkedForm)) || null
    return {
      source: linkedForm ? 'linked_form' : 'linked_form_missing',
      questions: linkedForm?.questions || [],
      linkedForm,
    }
  }

  const legacyQuestions = Array.isArray(definition.questions)
    ? definition.questions.map(mapLegacyQuestion).filter((question) => question.questionId || question.questionTitle)
    : []

  if (legacyQuestions.length > 0) {
    return {
      source: 'legacy',
      questions: legacyQuestions,
      linkedForm: null,
    }
  }

  return {
    source: 'none',
    questions: [],
    linkedForm: null,
  }
}

export function getDerivedProgramKind(
  dayNumber: number | null | undefined,
  config: Pick<AdminDayProgramConfig, 'gateDays' | 'retroEveryNDays'>,
): DerivedProgramKind {
  if (!dayNumber || dayNumber <= 0) return 'prework'
  if (config.gateDays.includes(dayNumber)) return 'gate'
  if (dayNumber % config.retroEveryNDays === 0) return 'weekly'
  return 'standard'
}

export function getDerivedProgramLabel(kind: DerivedProgramKind): string | null {
  if (kind === 'gate') return 'Gate Day'
  if (kind === 'weekly') return 'Weekly Retro'
  if (kind === 'prework') return 'Prework'
  return null
}

export function buildWorkbookStats(
  definitions: Array<{ blockType: string; definitionKind: 'base' | 'override'; dayNumber: number | null; linkedForm?: number | string | null }>,
  config: Pick<AdminDayProgramConfig, 'gateDays' | 'retroEveryNDays'>,
) {
  return definitions.reduce(
    (acc, definition) => {
      if (definition.definitionKind === 'override') {
        acc.overrides += 1
        return acc
      }

      if (definition.blockType !== 'day') {
        acc.otherBaseDefinitions += 1
        return acc
      }

      acc.baseDays += 1
      if (definition.linkedForm != null && definition.linkedForm !== '') {
        acc.baseDaysWithLinkedForms += 1
      }

      const derivedKind = getDerivedProgramKind(definition.dayNumber, config)
      if (derivedKind === 'gate') acc.gateDays += 1
      else if (derivedKind === 'weekly') acc.weeklyRetroDays += 1
      else if (derivedKind === 'standard') acc.standardDays += 1

      return acc
    },
    {
      baseDays: 0,
      baseDaysWithLinkedForms: 0,
      standardDays: 0,
      gateDays: 0,
      weeklyRetroDays: 0,
      overrides: 0,
      otherBaseDefinitions: 0,
    },
  )
}
