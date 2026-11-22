import type { Payload } from 'payload'

export const DAILY_SUMMARY_NOTE_HELPER = 'Summarize today\'s work in 2–3 sentences. The full artifact lives in your single Project Workspace URL (Notion / GDocs / Figma / etc.) — add today\'s output there.'

export function buildDayDefinitionFormSlug(dd: { blockKey?: string | null; id?: string | number | null }): string {
  const suffix = String(dd.blockKey || dd.id || 'day-definition')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `daily-${suffix || 'day-definition'}`
}

export function buildDayDefinitionFormTitle(dd: {
  activity?: string | null
  title?: string | null
  blockKey?: string | null
  dayNumber?: number | null
}): string {
  return dd.activity || dd.title || dd.blockKey || `Day ${dd.dayNumber ?? ''}`.trim()
}

export function buildDayBlockQuestions(dd: any) {
  const prefix = `DP${dd.dayNumber}`
  let idx = 1
  const qid = () => `${prefix}-${String(idx++).padStart(3, '0')}`

  return [
    {
      question_id: qid(),
      question_text: 'Summary Note',
      question_type: 'long_text',
      required: true,
      helperText: DAILY_SUMMARY_NOTE_HELPER,
    },
  ]
}

export function buildWeeklyRetroQuestions(_dd: any) {
  return [
    {
      question_id: 'retro_what_worked',
      question_text: 'What worked this week?',
      question_type: 'long_text',
      required: true,
      helperText: 'Reflect on what went well. Minimum 100 characters.',
    },
    {
      question_id: 'retro_what_didnt_work',
      question_text: "What didn't work?",
      question_type: 'long_text',
      required: true,
      helperText: 'Reflect on what needs improvement. Minimum 100 characters.',
    },
    {
      question_id: 'retro_priority_next_week',
      question_text: 'One priority for next week',
      question_type: 'short_text',
      required: true,
      helperText: 'What is the single most important thing you will focus on next week?',
    },
  ]
}

export function buildGateQuestions(dd: any) {
  const prefix = `G${dd.dayNumber}`
  let idx = 1
  const qid = () => `${prefix}-${String(idx++).padStart(3, '0')}`

  return [
    {
      question_id: qid(),
      question_text: dd.activity || `Gate Day ${dd.dayNumber}`,
      question_type: 'statement',
      required: false,
      helperText: [
        dd.theme ? `Theme: ${dd.theme}` : null,
        dd.deliverable ? `Deliverable: ${dd.deliverable}` : null,
      ].filter(Boolean).join(' | '),
    },
    {
      question_id: qid(),
      question_text: 'Gate self-assessment',
      question_type: 'long_text',
      required: true,
      helperText: dd.deliverable
        ? `Summarize your progress toward: ${dd.deliverable}. All gate artifacts should be saved in your Project Workspace URL.`
        : 'Summarize your progress and readiness for this gate. All gate artifacts should be saved in your Project Workspace URL.',
    },
    {
      question_id: qid(),
      question_text: 'Key metrics / evidence',
      question_type: 'long_text',
      required: true,
      helperText: 'List the quantitative and qualitative evidence supporting your progress.',
    },
    {
      question_id: qid(),
      question_text: 'Decision',
      question_type: 'multiple_choice_single',
      required: true,
      choices: [
        { label: 'Go', value: 'go' },
        { label: 'Flip', value: 'flip' },
        { label: 'Kill', value: 'kill' },
        { label: 'Accelerate', value: 'accelerate' },
      ],
    },
    {
      question_id: qid(),
      question_text: 'Mentor / IC ask (optional)',
      question_type: 'long_text',
      required: false,
      helperText: 'Any question for the Investment Committee or your mentor?',
    },
  ]
}

export function buildPreworkQuestions(dd: any) {
  const prefix = `PW${dd.dayNumber}`
  let idx = 1
  const qid = () => `${prefix}-${String(idx++).padStart(3, '0')}`

  return [
    {
      question_id: qid(),
      question_text: dd.activity || `Prework ${dd.dayNumber}`,
      question_type: 'statement',
      required: false,
      helperText: [
        dd.theme ? `Theme: ${dd.theme}` : null,
        dd.deliverable ? `Deliverable: ${dd.deliverable}` : null,
        dd.whereHowTips ? `Tips: ${dd.whereHowTips}` : null,
      ].filter(Boolean).join(' | '),
    },
    {
      question_id: qid(),
      question_text: 'Core output',
      question_type: 'long_text',
      required: true,
      helperText: dd.deliverable
        ? `Paste your main output or summary. Full artifact lives in your Project Workspace URL: ${dd.deliverable}`
        : 'Paste your main output or summary. Full artifact lives in your Project Workspace URL.',
    },
    {
      question_id: qid(),
      question_text: 'Mentor ask (optional)',
      question_type: 'long_text',
      required: false,
    },
  ]
}

export function buildFounderFormPayloadFromCurriculum(dd: any) {
  const title = buildDayDefinitionFormTitle(dd)
  const slug = buildDayDefinitionFormSlug(dd)

  let questions: any[]
  switch (dd.blockType) {
    case 'weekly':
      questions = buildWeeklyRetroQuestions(dd)
      break
    case 'gate':
      questions = buildGateQuestions(dd)
      break
    case 'prework':
      questions = buildPreworkQuestions(dd)
      break
    default:
      questions = buildDayBlockQuestions(dd)
      break
  }

  const sectionDescription = dd.blockType === 'day'
    ? undefined
    : [dd.deliverable, dd.whereHowTips].filter(Boolean).join(' — ') || undefined

  return {
    title,
    slug,
    questionsCount: questions.length,
    data: {
      title,
      slug,
      allowMultipleSubmissions: true,
      sections: [
        {
          id: dd.blockKey || `section-${dd.id}`,
          title,
          description: sectionDescription,
          questions,
        },
      ],
    },
  }
}

export async function upsertFounderFormFromCurriculum(payload: Payload, dd: any) {
  const { data, slug, title, questionsCount } = buildFounderFormPayloadFromCurriculum(dd)
  const existing = await payload.find({
    collection: 'founder-forms',
    where: { slug: { equals: slug } },
    limit: 1,
  })

  if (existing.totalDocs > 0) {
    const updated = await payload.update({
      collection: 'founder-forms',
      id: existing.docs[0].id,
      data,
    })

    return {
      action: 'updated' as const,
      formId: updated.id,
      slug,
      title,
      questionsCount,
    }
  }

  const created = await payload.create({
    collection: 'founder-forms',
    data,
  })

  return {
    action: 'created' as const,
    formId: created.id,
    slug,
    title,
    questionsCount,
  }
}
