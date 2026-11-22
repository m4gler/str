import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { headers as getHeaders } from 'next/headers'
import * as XLSX from 'xlsx'

/**
 * POST /api/import-investor-form
 *
 * Admin-only endpoint that imports investor form questions from an Excel file
 * into an InvestorForms document.
 *
 * Reads the "INVESTOR FORM" sheet. Expected columns:
 *   section, question_id, question_type, required, question_text,
 *   choice_1..choice_12, notes
 *
 * Also reads the "MISSING QUESTIONS TO ADD" section (rows after the main form)
 * which uses columns: Section, Question ID, Question, Type,
 *   Options (pipe-separated), Logic, Notes
 *
 * Body: multipart/form-data with field "file" (xlsx)
 *   OR JSON { "filePath": "..." } for server-side seed
 *
 * Query params:
 *   ?slug=investor-intake-v1  — target form slug (created if not found)
 *   ?title=Investor Intake    — form title (used when creating new)
 */

interface ParsedQuestion {
  question_id: string
  question_text: string
  question_type: string
  required: boolean
  choices: { label: string; value: string }[]
  logic?: string
  helperText?: string
}

interface ParsedSection {
  key: string
  title: string
  description?: string
  questions: ParsedQuestion[]
}

const INVESTOR_COUNTRIES = [
  'Austria',
  'Belgium',
  'Bulgaria',
  'Croatia',
  'Cyprus',
  'Czech Republic',
  'Denmark',
  'Estonia',
  'Finland',
  'France',
  'Germany',
  'Greece',
  'Hungary',
  'Ireland',
  'Italy',
  'Latvia',
  'Lithuania',
  'Luxembourg',
  'Malta',
  'Netherlands',
  'Poland',
  'Portugal',
  'Romania',
  'Slovakia',
  'Slovenia',
  'Spain',
  'Sweden',
  'United Kingdom',
  'United States',
  'CEE',
  'New Baltics',
  'Balkans',
  'Other',
].map((country) => ({ label: country, value: country }))

function mapQuestionType(raw: string | null): string {
  if (!raw) return 'short_text'
  const map: Record<string, string> = {
    short_text: 'short_text',
    long_text: 'long_text',
    email: 'email',
    url: 'url',
    number: 'number',
    dropdown: 'dropdown',
    multiple_choice_single: 'multiple_choice_single',
    multiple_choice_multiple: 'multiple_choice_multiple',
    yes_no: 'yes_no',
    range: 'range',
    opinion_scale: 'range',
    statement: 'statement',
    // Aliases from the "MISSING QUESTIONS" section
    single_choice: 'multiple_choice_single',
    multi_select: 'multiple_choice_multiple',
  }
  return map[raw.trim()] || 'short_text'
}

function cleanSectionTitle(key: string): string {
  // "0_Consent_Basics" → "Consent & Basics"
  return key
    .replace(/^\d+_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function buildShowIfLogic(refQuestionId: string, values: string[]): string {
  return `SHOW_IF:${refQuestionId}:${values.join('|')}`
}

function parseMainFormSheet(ws: XLSX.WorkSheet): { sections: ParsedSection[]; missingStart: number } {
  const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { header: 1, defval: '' })
  const sections: ParsedSection[] = []
  const sectionMap = new Map<string, ParsedSection>()

  let missingStart = -1

  for (let i = 1; i < data.length; i++) {
    const row = data[i] as any[]
    if (!row || row.length === 0) continue

    // Detect "MISSING QUESTIONS TO ADD" boundary
    const firstCell = String(row[0] || '').trim()
    if (firstCell.toUpperCase().includes('MISSING QUESTIONS')) {
      missingStart = i
      break
    }

    const sectionKey = String(row[0] || '').trim()
    const questionId = String(row[1] || '').trim()
    const questionType = String(row[2] || '').trim()
    const required = String(row[3] || '').trim().toUpperCase() === 'Y'
    const questionText = String(row[4] || '').trim()

    if (!questionId || !questionText) continue

    // Collect choices from columns 5–16
    let choices: { label: string; value: string }[] = []
    for (let c = 5; c <= 16; c++) {
      const val = String(row[c] || '').trim()
      if (!val) break
      // Skip if the choice text is the same as the question text (header duplication)
      if (val === questionText) continue
      choices.push({ label: val, value: val })
    }

    const notes = String(row[17] || '').trim()
    const notesLower = notes.toLowerCase()

    if (
      questionId === 'I1_COUNTRY' ||
      notesLower.includes('typeform country dropdown')
    ) {
      choices = INVESTOR_COUNTRIES
    }

    if (!sectionMap.has(sectionKey)) {
      const section: ParsedSection = {
        key: sectionKey,
        title: cleanSectionTitle(sectionKey),
        questions: [],
      }
      sectionMap.set(sectionKey, section)
      sections.push(section)
    }

    sectionMap.get(sectionKey)!.questions.push({
      question_id: questionId,
      question_text: questionText,
      question_type: mapQuestionType(questionType),
      required,
      choices,
      helperText: notes || undefined,
    })
  }

  return { sections, missingStart }
}

function parseMissingQuestionsSection(
  ws: XLSX.WorkSheet,
  startRow: number,
): ParsedSection[] {
  const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { header: 1, defval: '' })
  const sections: ParsedSection[] = []
  const sectionMap = new Map<string, ParsedSection>()

  // Find the header row for the missing questions section
  let headerRow = -1
  for (let i = startRow; i < data.length; i++) {
    const row = data[i] as any[]
    const first = String(row?.[0] || '').trim().toLowerCase()
    if (first === 'section') {
      headerRow = i
      break
    }
  }

  if (headerRow === -1) return sections

  // Parse rows after the header
  // Columns: Section, Question ID, Question, Type, Options (pipe-separated), Logic, Notes
  for (let i = headerRow + 1; i < data.length; i++) {
    const row = data[i] as any[]
    if (!row || row.length === 0) continue

    const sectionName = String(row[0] || '').trim()
    const questionId = String(row[1] || '').trim()
    const questionText = String(row[2] || '').trim()
    const questionType = String(row[3] || '').trim()
    const optionsRaw = String(row[4] || '').trim()
    const logicRaw = String(row[5] || '').trim()
    const notes = String(row[6] || '').trim()

    if (!questionId || !questionText) continue

    // Parse pipe-separated options
    const choices: { label: string; value: string }[] = optionsRaw
      ? optionsRaw
          .split('|')
          .map((o) => o.trim())
          .filter(Boolean)
          .map((o) => ({ label: o, value: o }))
      : []

    // Parse logic: convert Excel logic expressions to our format
    // Gate questions ("IF answer in {...} THEN show ... ELSE skip") define gates — no SHOW_IF
    // Dependent questions ("SHOW ONLY IF <question_id> in {...}") get SHOW_IF
    let logic: string | undefined
    if (logicRaw) {
      // "SHOW ONLY IF Q4_FOUNDER_MATCH in {Yes, actively, Yes, selectively}"
      const showOnlyMatch = logicRaw.match(
        /SHOW\s+ONLY\s+IF\s+(\w+)\s+in\s*\{([^}]+)\}/i,
      )
      if (showOnlyMatch) {
        const refId = showOnlyMatch[1]
        const values = showOnlyMatch[2]
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
        logic = buildShowIfLogic(refId, values)
      }
      // "IF answer in {...} THEN show ..." — this is a gate definition, NOT a dependency
      // Gate questions are always visible, so no logic is set
    }

    const sectionKey = sectionName || 'Strategy_Expertise_Matchmaking'

    if (!sectionMap.has(sectionKey)) {
      const section: ParsedSection = {
        key: sectionKey,
        title: sectionName || 'Strategy, Expertise & Matchmaking',
        questions: [],
      }
      sectionMap.set(sectionKey, section)
      sections.push(section)
    }

    sectionMap.get(sectionKey)!.questions.push({
      question_id: questionId,
      question_text: questionText,
      question_type: mapQuestionType(questionType),
      required: false, // conditional questions default to optional
      choices,
      logic,
      helperText: notes || undefined,
    })
  }

  return sections
}

export async function POST(request: NextRequest) {
  const payload = await getPayload({ config })
  const hdrs = await getHeaders()

  const { user } = await payload.auth({ headers: hdrs })
  if (!user || (user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 })
  }

  const rawSlug = request.nextUrl.searchParams.get('slug') || 'investor-intake-v1'
  const slug = /^[a-z0-9\-]{1,100}$/.test(rawSlug) ? rawSlug : 'investor-intake-v1'
  const rawTitle = request.nextUrl.searchParams.get('title') || 'Investor Intake Form'
  const title = rawTitle.slice(0, 200)

  let workbook: XLSX.WorkBook
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 50 MB)' }, { status: 400 })
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    workbook = XLSX.read(buffer, { type: 'buffer' })
  } else {
    const body = await request.json().catch(() => ({}))
    const path = await import('path')
    const defaultFile = 'MESGA_Investor_Intake_Typeform_Blueprint.xlsx'
    const filePath = body.filePath || path.join(process.cwd(), defaultFile)
    const fs = await import('fs')
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Source file not found on server' }, { status: 400 })
    }
    const buffer = fs.readFileSync(filePath)
    workbook = XLSX.read(buffer, { type: 'buffer' })
  }

  // Find "INVESTOR FORM" sheet
  const sheetName = workbook.SheetNames.find((n) =>
    n.toUpperCase().includes('INVESTOR FORM'),
  ) || workbook.SheetNames[0]
  const ws = workbook.Sheets[sheetName]
  if (!ws) {
    return NextResponse.json({ error: 'No worksheet found' }, { status: 400 })
  }

  // Parse main form questions
  const { sections: mainSections, missingStart } = parseMainFormSheet(ws)

  // Parse "MISSING QUESTIONS TO ADD" section if present
  let missingSections: ParsedSection[] = []
  if (missingStart > 0) {
    missingSections = parseMissingQuestionsSection(ws, missingStart)
  }

  // Merge all sections
  const allSections = [...mainSections, ...missingSections]

  // Build Payload sections data
  const payloadSections = allSections.map((s) => ({
    title: s.title,
    description: s.description,
    questions: s.questions.map((q) => ({
      question_id: q.question_id,
      question_text: q.question_text,
      question_type: q.question_type,
      required: q.required,
      choices: q.choices.length > 0 ? q.choices : undefined,
      helperText: q.helperText,
      logic: q.logic,
    })),
  }))

  // Upsert the form
  const existing = await payload.find({
    collection: 'investor-forms',
    where: { slug: { equals: slug } },
    limit: 1,
  })

  let formId: number
  if (existing.totalDocs > 0) {
    await (payload as any).update({
      collection: 'investor-forms',
      id: existing.docs[0].id,
      data: {
        title,
        slug,
        sections: payloadSections,
      },
    })
    formId = existing.docs[0].id
  } else {
    const created = await (payload as any).create({
      collection: 'investor-forms',
      data: {
        title,
        slug,
        sections: payloadSections,
      },
    })
    formId = created.id
  }

  const totalQuestions = allSections.reduce((acc, s) => acc + s.questions.length, 0)
  const conditionalQuestions = allSections.reduce(
    (acc, s) => acc + s.questions.filter((q) => q.logic).length,
    0,
  )

  return NextResponse.json({
    success: true,
    formId,
    slug,
    sheetName,
    sections: allSections.length,
    totalQuestions,
    conditionalQuestions,
    message: `Imported ${totalQuestions} questions across ${allSections.length} sections (${conditionalQuestions} with conditional logic) into form "${slug}".`,
  })
}
