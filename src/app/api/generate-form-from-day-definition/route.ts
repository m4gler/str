import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { headers as getHeaders } from 'next/headers'

/**
 * POST /api/generate-form-from-day-definition
 *
 * Admin-only legacy/manual helper. Takes a DayDefinition ID and creates
 * (or updates) a FounderForm from its embedded `questions` array, then links
 * the form back to the DayDefinition.
 *
 * Imported curriculum records should use
 * `/api/rebuild-linked-form-from-day-definition` instead.
 *
 * Body: { dayDefinitionId: string | number }
 */

function mapQuestionType(ddType: string): string {
  const map: Record<string, string> = {
    statement: 'statement',
    short_text: 'short_text',
    long_text: 'long_text',
    email: 'email',
    website_url: 'url',
    number: 'number',
    yes_no: 'yes_no',
    multiple_choice: 'multiple_choice_single',
    dropdown: 'dropdown',
    opinion_scale: 'range',
    file_upload: 'file_upload',
  }
  return map[ddType] || 'short_text'
}

export async function POST(request: NextRequest) {
  const payload = await getPayload({ config })
  const hdrs = await getHeaders()

  const { user } = await payload.auth({ headers: hdrs })
  if (!user || (user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { dayDefinitionId } = body

  if (!dayDefinitionId) {
    return NextResponse.json({ error: 'dayDefinitionId is required' }, { status: 400 })
  }

  const dd = await payload.findByID({
    collection: 'day-definitions',
    id: dayDefinitionId,
  }) as any

  if (!dd) {
    return NextResponse.json({ error: 'Day definition not found' }, { status: 404 })
  }

  if ((dd as any).definitionKind === 'override') {
    return NextResponse.json(
      { error: 'Legacy question forms can only be generated from base curriculum definitions, not override records.' },
      { status: 400 },
    )
  }

  const questions = dd.questions || []
  if (questions.length === 0) {
    return NextResponse.json(
      {
        error: 'No embedded legacy questions found on this day definition. Imported workbook records should rebuild their linked form from curriculum fields instead.',
      },
      { status: 400 },
    )
  }

  // Build slug from blockKey
  const slug = `daily-${dd.blockKey?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || dd.id}`
  const title = dd.activity || dd.title || dd.blockKey || `Day ${dd.dayNumber}`

  // Map questions to FounderForm format
  const formQuestions = questions.map((q: any) => {
    const mapped: any = {
      question_id: q.questionId,
      question_text: q.questionTitle,
      question_type: mapQuestionType(q.questionType),
      required: q.required || false,
    }

    if (q.description) mapped.helperText = q.description
    if (q.questionType === 'statement') {
      mapped.helperText = q.description || ''
      mapped.required = false
    }

    // Parse pipe-separated choices
    if (q.choices && (q.questionType === 'dropdown' || q.questionType === 'multiple_choice')) {
      mapped.choices = q.choices.split('|').map((c: string) => ({
        label: c.trim(),
        value: c.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      }))
    }

    // Generate choices for opinion_scale → range (parse range from title like "Self-score (0–5)")
    if (q.questionType === 'opinion_scale') {
      const rangeMatch = (q.questionTitle || '').match(/\((\d+)[–-](\d+)\)/)
      const rangeStart = rangeMatch ? parseInt(rangeMatch[1]) : 0
      const rangeEnd = rangeMatch ? parseInt(rangeMatch[2]) : 5
      mapped.choices = Array.from({ length: rangeEnd - rangeStart + 1 }, (_, i) => ({
        label: String(rangeStart + i),
        value: String(rangeStart + i),
      }))
    }

    return mapped
  })

  // Build the form sections (one section per day definition)
  const formData: any = {
    title,
    slug,
    allowMultipleSubmissions: true,
    sections: [
      {
        id: dd.blockKey || `section-${dd.id}`,
        title: title,
        description: dd.blockType === 'day'
          ? undefined
          : [dd.deliverable, dd.whereHowTips].filter(Boolean).join(' — ') || undefined,
        questions: formQuestions,
      },
    ],
  }

  // Check if form exists
  const existing = await payload.find({
    collection: 'founder-forms',
    where: { slug: { equals: slug } },
    limit: 1,
  })

  let formId: string | number
  if (existing.totalDocs > 0) {
    const updated = await payload.update({
      collection: 'founder-forms',
      id: existing.docs[0].id,
      data: formData,
    })
    formId = updated.id
  } else {
    const created = await payload.create({
      collection: 'founder-forms',
      data: formData,
    })
    formId = created.id
  }

  // Link form back to day definition
  await payload.update({
    collection: 'day-definitions',
    id: dayDefinitionId,
    data: { linkedForm: formId },
  })

  return NextResponse.json({
    success: true,
    formId,
    slug,
    title,
    questionsCount: formQuestions.length,
    message: `Legacy/manual form "${title}" (${slug}) ${existing.totalDocs > 0 ? 'updated' : 'created'} with ${formQuestions.length} questions.`,
  })
}
