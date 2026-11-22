export type FormCollectionSlug = 'founder-forms' | 'investor-forms'

export type FormTextField =
  | 'title'
  | 'description'
  | 'question_id'
  | 'question_text'
  | 'placeholder'
  | 'helperText'
  | 'exampleHintTitle'
  | 'exampleHintBody'
  | 'choice_label'
  | 'choice_value'

export type FormQuestion = {
  question_id?: string
  question_text?: string
  question_type?: string
  placeholder?: string
  helperText?: string
  exampleHintTitle?: string
  exampleHintBody?: string
  choices?: Array<{ label?: string; value?: string; [key: string]: unknown }>
  [key: string]: unknown
}

export type FormSection = {
  title?: string
  description?: string
  questions?: FormQuestion[]
  [key: string]: unknown
}

export type FormDoc = {
  id?: string | number
  title?: string
  sections?: FormSection[]
  [key: string]: unknown
}

export type FormMatch = {
  key: string
  collectionSlug: FormCollectionSlug
  docId: string | number
  docTitle: string
  field: FormTextField
  fieldLabel: string
  value: string
  occurrences: number
  questionType?: string
  sectionIdx: number
  questionIdx?: number
  choiceIdx?: number
}

export type FindOptions = {
  query: string
  caseSensitive?: boolean
  wholeWord?: boolean
  field?: FormTextField | 'all'
  questionType?: string | 'all'
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildMatcher = (query: string, options: Pick<FindOptions, 'caseSensitive' | 'wholeWord'>) => {
  const escaped = escapeRegExp(query)
  const source = options.wholeWord
    ? `(^|[^\\p{L}\\p{N}_])(${escaped})(?=$|[^\\p{L}\\p{N}_])`
    : `(${escaped})`
  return new RegExp(source, `${options.caseSensitive ? 'g' : 'gi'}u`)
}

export const countTextMatches = (
  value: string,
  query: string,
  options: Pick<FindOptions, 'caseSensitive' | 'wholeWord'> = {},
) => {
  if (!query) return 0
  return Array.from(value.matchAll(buildMatcher(query, options))).length
}

export const findFirstTextMatch = (
  value: string,
  query: string,
  options: Pick<FindOptions, 'caseSensitive' | 'wholeWord'> = {},
) => {
  if (!query) return null
  const match = buildMatcher(query, options).exec(value)
  if (!match || match.index == null) return null
  const prefixLength = options.wholeWord ? (match[1]?.length || 0) : 0
  return { index: match.index + prefixLength, length: query.length }
}

export const replaceTextMatches = (
  value: string,
  query: string,
  replacement: string,
  options: Pick<FindOptions, 'caseSensitive' | 'wholeWord'> = {},
) => {
  if (!query) return value
  if (!options.wholeWord) return value.replace(buildMatcher(query, options), replacement)
  return value.replace(buildMatcher(query, options), (_match, prefix: string) => `${prefix}${replacement}`)
}

export const formMatchKey = (
  collectionSlug: FormCollectionSlug,
  docId: string | number,
  sectionIdx: number,
  field: FormTextField,
  questionIdx?: number,
  choiceIdx?: number,
) => [collectionSlug, docId, sectionIdx, questionIdx ?? '-', choiceIdx ?? '-', field].join(':')

export const findMatchesInForm = (
  doc: FormDoc,
  collectionSlug: FormCollectionSlug,
  options: FindOptions,
): FormMatch[] => {
  if (!doc.id || !options.query) return []
  const matches: FormMatch[] = []
  const docTitle = doc.title?.trim() || String(doc.id)

  const add = (params: Omit<FormMatch, 'key' | 'collectionSlug' | 'docId' | 'docTitle' | 'occurrences'>) => {
    if (options.field && options.field !== 'all' && options.field !== params.field) return
    if (options.questionType && options.questionType !== 'all' && params.questionType !== options.questionType) return
    const occurrences = countTextMatches(params.value, options.query, options)
    if (!occurrences) return
    matches.push({
      ...params,
      key: formMatchKey(collectionSlug, doc.id!, params.sectionIdx, params.field, params.questionIdx, params.choiceIdx),
      collectionSlug,
      docId: doc.id!,
      docTitle,
      occurrences,
    })
  }

  ;(doc.sections || []).forEach((section, sectionIdx) => {
    const sectionName = section.title?.trim() || `Section ${sectionIdx + 1}`
    if (typeof section.title === 'string') {
      add({ field: 'title', fieldLabel: `Section ${sectionIdx + 1} → title`, value: section.title, sectionIdx })
    }
    if (typeof section.description === 'string') {
      add({ field: 'description', fieldLabel: `${sectionName} → description`, value: section.description, sectionIdx })
    }

    ;(section.questions || []).forEach((question, questionIdx) => {
      const questionName = question.question_id?.trim()
        ? `${sectionName} → Q${questionIdx + 1} (${question.question_id})`
        : `${sectionName} → Q${questionIdx + 1}`
      const base = { sectionIdx, questionIdx, questionType: question.question_type }
      const questionFields: Array<[FormTextField, string, unknown]> = [
        ['question_id', 'question id', question.question_id],
        ['question_text', 'question text', question.question_text],
        ['placeholder', 'placeholder', question.placeholder],
        ['helperText', 'helper text', question.helperText],
        ['exampleHintTitle', 'example hint title', question.exampleHintTitle],
        ['exampleHintBody', 'example hint body', question.exampleHintBody],
      ]
      questionFields.forEach(([field, label, value]) => {
        if (typeof value === 'string') add({ ...base, field, fieldLabel: `${questionName} → ${label}`, value })
      })
      ;(question.choices || []).forEach((choice, choiceIdx) => {
        if (typeof choice.label === 'string') {
          add({ ...base, choiceIdx, field: 'choice_label', fieldLabel: `${questionName} → choice ${choiceIdx + 1} label`, value: choice.label })
        }
        if (typeof choice.value === 'string') {
          add({ ...base, choiceIdx, field: 'choice_value', fieldLabel: `${questionName} → choice ${choiceIdx + 1} value`, value: choice.value })
        }
      })
    })
  })

  return matches
}

const getMatchValue = (doc: FormDoc, match: FormMatch): string | undefined => {
  const section = doc.sections?.[match.sectionIdx]
  if (!section) return undefined
  if (match.field === 'title' || match.field === 'description') return section[match.field] as string | undefined
  const question = section.questions?.[match.questionIdx ?? -1]
  if (!question) return undefined
  if (match.field === 'choice_label') return question.choices?.[match.choiceIdx ?? -1]?.label
  if (match.field === 'choice_value') return question.choices?.[match.choiceIdx ?? -1]?.value
  return question[match.field] as string | undefined
}

export const replaceSelectedFormMatches = (
  doc: FormDoc,
  matches: FormMatch[],
  query: string,
  replacement: string,
  options: Pick<FindOptions, 'caseSensitive' | 'wholeWord'> = {},
) => {
  const next: FormDoc = {
    ...doc,
    sections: (doc.sections || []).map(section => ({
      ...section,
      questions: (section.questions || []).map(question => ({
        ...question,
        choices: (question.choices || []).map(choice => ({ ...choice })),
      })),
    })),
  }
  let replacedFields = 0
  let replacedOccurrences = 0
  let staleFields = 0

  matches.forEach(match => {
    const currentValue = getMatchValue(next, match)
    if (currentValue !== match.value) {
      staleFields += 1
      return
    }
    const occurrences = countTextMatches(currentValue, query, options)
    if (!occurrences) {
      staleFields += 1
      return
    }
    const newValue = replaceTextMatches(currentValue, query, replacement, options)
    const section = next.sections?.[match.sectionIdx]
    const question = section?.questions?.[match.questionIdx ?? -1]
    if (match.field === 'title' || match.field === 'description') {
      if (section) section[match.field] = newValue
    } else if (match.field === 'choice_label') {
      const choice = question?.choices?.[match.choiceIdx ?? -1]
      if (choice) choice.label = newValue
    } else if (match.field === 'choice_value') {
      const choice = question?.choices?.[match.choiceIdx ?? -1]
      if (choice) choice.value = newValue
    } else if (question) {
      question[match.field] = newValue
    }
    replacedFields += 1
    replacedOccurrences += occurrences
  })

  return { doc: next, replacedFields, replacedOccurrences, staleFields }
}
