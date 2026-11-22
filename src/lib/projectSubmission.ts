type FormChoice = {
  label?: string | null
  value?: string | null
}

type FormQuestion = {
  question_id?: string | null
  question_text?: string | null
  choices?: FormChoice[] | null
}

type FormSection = {
  id?: string | null
  title?: string | null
  questions?: FormQuestion[] | null
}

type FounderFormLike = {
  sections?: FormSection[] | null
}

const PROJECT_SECTION_IDS = ['idea_a', 'existing_b', 'join']
const PROJECT_SECTION_TITLES = new Set(['your idea', 'what you do', 'join preferences'])
const PLACEHOLDER_ANSWERS = new Set(['a', 'n/a', 'na', 'none', '-', 'tbd'])

function isFilledValue(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

function formatChoiceLabel(question: FormQuestion, value: unknown): string {
  const choices = Array.isArray(question.choices) ? question.choices : []
  const found = choices.find((choice) => String(choice.value ?? '') === String(value))
  return found?.label?.trim() || String(value)
}

function formatAnswer(question: FormQuestion, rawValue: unknown): string | null {
  if (!isFilledValue(rawValue)) return null

  if (Array.isArray(rawValue)) {
    const values = rawValue
      .map((value) => formatChoiceLabel(question, value))
      .filter((value) => value.trim().length > 0)

    return values.length > 0 ? values.join(', ') : null
  }

  if (typeof rawValue === 'boolean') {
    return rawValue ? 'Yes' : 'No'
  }

  const formatted = formatChoiceLabel(question, rawValue).trim()
  if (!formatted) return null
  if (PLACEHOLDER_ANSWERS.has(formatted.toLowerCase())) return null
  return formatted
}

function findProjectSection(form: FounderFormLike | null | undefined): FormSection | null {
  const sections = Array.isArray(form?.sections) ? form.sections : []

  for (const section of sections) {
    if (section?.id && PROJECT_SECTION_IDS.includes(section.id)) return section
  }

  for (const section of sections) {
    if (PROJECT_SECTION_TITLES.has((section?.title || '').trim().toLowerCase())) return section
  }

  return null
}

export function extractProjectIdeaSectionDescription(
  form: FounderFormLike | null | undefined,
  submissionData: Record<string, unknown> | null | undefined,
): string {
  const section = findProjectSection(form)
  const answers = submissionData || {}

  if (section?.questions?.length) {
    const lines = section.questions
      .map((question) => {
        const questionId = question.question_id || ''
        const answer = formatAnswer(question, answers[questionId])
        if (!answer) return null
        const label = (question.question_text || questionId).trim()
        return `${label}: ${answer}`
      })
      .filter((line): line is string => Boolean(line))

    if (lines.length > 0) return lines.join('\n')
  }

  return 'Intake form submission'
}

export function normalizeProjectDescriptionForEditing(
  projectDescription: string | null | undefined,
  legacyDraftDescription: string | null | undefined,
  status?: string | null,
): string {
  const current = typeof projectDescription === 'string' ? projectDescription : ''
  const currentTrimmed = current.trim()
  if (!currentTrimmed) return ''

  const legacyTrimmed = typeof legacyDraftDescription === 'string' ? legacyDraftDescription.trim() : ''
  if (status === 'pending' && legacyTrimmed && currentTrimmed === legacyTrimmed) {
    return ''
  }

  return current
}

function hasFilledText(value: string | null | undefined): boolean {
  return (value ?? '').trim().length > 0
}

export function canFounderEditProjectSubmission(
  submission: {
    status?: string | null
    projectDescription?: string | null
    workspaceUrl?: string | null
  } | null | undefined,
): { canEditDescription: boolean; canEditWorkspaceUrl: boolean } {
  if (!submission) {
    return { canEditDescription: true, canEditWorkspaceUrl: true }
  }

  const status = submission.status || 'pending'
  if (status === 'pending') {
    return { canEditDescription: true, canEditWorkspaceUrl: true }
  }

  return {
    canEditDescription: false,
    canEditWorkspaceUrl: status === 'approved' && !hasFilledText(submission.workspaceUrl),
  }
}

export function isProjectDescriptionRequiredForFounderSave(
  submission: {
    status?: string | null
    projectDescription?: string | null
    workspaceUrl?: string | null
  } | null | undefined,
): boolean {
  return canFounderEditProjectSubmission(submission).canEditDescription
}
