import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { headers as getHeaders } from 'next/headers'
import * as fs from 'fs'
import * as path from 'path'

/**
 * POST /api/seed-from-descriptions
 *
 * Admin-only. Reads MESGA_100Days_Descriptions.md, parses the Review sheet,
 * creates/updates DayDefinitions and generates FounderForms for all 110 blocks
 * (10 prework + 100 day blocks).
 *
 * Does NOT touch personality test or intake forms.
 *
 * Body (optional): { dryRun?: boolean, deletePrevious?: boolean }
 */

interface ParsedRow {
  block: string
  dayLabel: string
  week: number
  theme: string
  deliverable: string
  autoCheck: string
  questionId: string
  questionTitle: string
  type: string
  originalDesc: string
  newDesc: string
}

interface BlockData {
  blockKey: string
  dayLabel: string
  week: number
  theme: string
  deliverable: string
  autoCheck: string
  questions: {
    questionId: string
    questionTitle: string
    questionType: string
    required: boolean
    description: string
    choices?: string
  }[]
}

function parseReviewSheet(content: string): ParsedRow[] {
  const lines = content.split('\n')

  // Find boundaries
  const reviewStartIdx = lines.findIndex((l) => l.startsWith('## Sheet: Review'))
  const importReadyIdx = lines.findIndex((l) => l.startsWith('## Sheet: Import Ready'))

  if (reviewStartIdx === -1) {
    throw new Error('Could not find "## Sheet: Review" section in file')
  }

  const sectionLines = lines.slice(
    reviewStartIdx + 1,
    importReadyIdx > 0 ? importReadyIdx : undefined,
  )

  // Find header row
  const headerIdx = sectionLines.findIndex((l) => l.startsWith('| BLOCK'))
  if (headerIdx === -1) {
    throw new Error('Could not find table header in Review section')
  }
  const dataLines = sectionLines.slice(headerIdx + 2) // Skip header + separator

  // Merge multiline rows: a new row starts with | PREWORK-BLOCK- or | DAY-BLOCK-
  const rawRows: string[] = []
  let current = ''

  for (const line of dataLines) {
    const isRowStart = /^\| (PREWORK-BLOCK-|DAY-BLOCK-)/.test(line)
    if (isRowStart) {
      if (current) rawRows.push(current)
      current = line
    } else if (current) {
      current += '\n' + line
    }
  }
  if (current) rawRows.push(current)

  // Parse each merged row
  const results: ParsedRow[] = []
  for (const rawRow of rawRows) {
    const firstLine = rawRow.split('\n')[0]

    // Find pipe positions on the first line
    const pipePositions: number[] = []
    for (let i = 0; i < firstLine.length; i++) {
      if (firstLine[i] === '|') pipePositions.push(i)
    }

    // We need at least 11 pipes: | c1 | c2 | c3 | c4 | c5 | c6 | c7 | c8 | c9 | c10 | c11...
    if (pipePositions.length < 11) continue

    const col = (start: number, end: number) =>
      firstLine.substring(pipePositions[start] + 1, pipePositions[end]).trim()

    const block = col(0, 1)
    const dayLabel = col(1, 2)
    const weekStr = col(2, 3)
    const theme = col(3, 4)
    const deliverable = col(4, 5)
    const autoCheck = col(5, 6)
    const questionId = col(6, 7)
    const questionTitle = col(7, 8)
    const type = col(8, 9)
    const originalDesc = col(9, 10)

    // NEW DESC: from after the 11th pipe to end of row, minus trailing |
    let newDesc = firstLine.substring(pipePositions[10] + 1).trim()
    const restLines = rawRow.split('\n').slice(1)
    if (restLines.length > 0) {
      const continuation = restLines.join('\n').replace(/\|\s*$/, '').trim()
      if (continuation) {
        newDesc = newDesc + '\n' + continuation
      }
    }
    // Remove trailing pipe if present
    newDesc = newDesc.replace(/\|\s*$/, '').trim()

    if (!questionId) continue

    results.push({
      block,
      dayLabel,
      week: parseFloat(weekStr) || 0,
      theme,
      deliverable,
      autoCheck,
      questionId,
      questionTitle,
      type,
      originalDesc,
      newDesc,
    })
  }

  return results
}

function groupByBlock(rows: ParsedRow[]): BlockData[] {
  const blockMap = new Map<string, BlockData>()
  const blockOrder: string[] = []

  for (const row of rows) {
    if (!blockMap.has(row.block)) {
      blockMap.set(row.block, {
        blockKey: row.block,
        dayLabel: row.dayLabel,
        week: row.week,
        theme: row.theme,
        deliverable: row.deliverable,
        autoCheck: row.autoCheck,
        questions: [],
      })
      blockOrder.push(row.block)
    }

    const block = blockMap.get(row.block)!

    // Fill in metadata from rows that have it (first row usually has deliverable/autoCheck)
    if (row.deliverable && !block.deliverable) block.deliverable = row.deliverable
    if (row.autoCheck && !block.autoCheck) block.autoCheck = row.autoCheck
    if (row.theme && !block.theme) block.theme = row.theme

    // Determine if question is required
    const isStatement = row.type === 'statement'
    const isOptional = row.questionTitle.toLowerCase().includes('(optional)')
    const isRequired = !isStatement && !isOptional

    // Handle multiple_choice choices
    let choices: string | undefined
    if (row.type === 'multiple_choice') {
      choices = 'Go|Flip|Kill|Accelerate'
    }

    block.questions.push({
      questionId: row.questionId,
      questionTitle: row.questionTitle,
      questionType: row.type,
      required: isRequired,
      description: row.newDesc,
      choices,
    })
  }

  return blockOrder.map((key) => blockMap.get(key)!)
}

function getBlockType(blockKey: string): string {
  if (blockKey.startsWith('PREWORK-BLOCK-')) return 'prework'
  return 'day'
}

function extractDayNumber(blockKey: string): number | null {
  const match = blockKey.match(/(\d+)$/)
  return match ? parseInt(match[1], 10) : null
}

// Map DayDefinition question types to FounderForm question types
function mapToFounderFormType(ddType: string): string {
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
    return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const dryRun = body.dryRun === true
  const deletePrevious = body.deletePrevious === true

  // Read the Markdown file
  const mdPath = path.join(
    process.cwd(),
    'MESGA 100 Days Acc OS',
    'MESGA_100Days_Descriptions.md',
  )
  if (!fs.existsSync(mdPath)) {
    return NextResponse.json({ error: `File not found: ${mdPath}` }, { status: 400 })
  }

  const content = fs.readFileSync(mdPath, 'utf-8')

  // Parse the Review sheet
  let parsedRows: ParsedRow[]
  try {
    parsedRows = parseReviewSheet(content)
  } catch (err: any) {
    return NextResponse.json({ error: `Parse error: ${err.message}` }, { status: 400 })
  }

  const blocks = groupByBlock(parsedRows)

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      totalRows: parsedRows.length,
      totalBlocks: blocks.length,
      preworkBlocks: blocks.filter((b) => b.blockKey.startsWith('PREWORK-')).length,
      dayBlocks: blocks.filter((b) => b.blockKey.startsWith('DAY-')).length,
      sampleBlock: blocks[0],
      sampleLastBlock: blocks[blocks.length - 1],
    })
  }

  // Optionally delete previous daily forms and day definitions
  if (deletePrevious) {
    // Delete old FounderForms with daily-* slugs (preserve intake + personality test)
    const oldForms = await payload.find({
      collection: 'founder-forms',
      where: {
        slug: { like: 'daily-%' },
      },
      limit: 500,
      depth: 0,
    })
    for (const form of oldForms.docs) {
      await payload.delete({ collection: 'founder-forms', id: form.id })
    }

    // Delete old DayDefinitions
    const oldDefs = await payload.find({
      collection: 'day-definitions',
      limit: 500,
      depth: 0,
    })
    for (const dd of oldDefs.docs) {
      await payload.delete({ collection: 'day-definitions', id: dd.id })
    }
  }

  const stats = {
    defsCreated: 0,
    defsUpdated: 0,
    formsCreated: 0,
    formsUpdated: 0,
    errors: [] as string[],
  }

  for (const block of blocks) {
    try {
      const blockType = getBlockType(block.blockKey)
      const dayNumber = extractDayNumber(block.blockKey)

      // Determine day_type for gate/retro/standard classification
      let isGateDay = false
      let gateDayNumber: number | undefined
      if (blockType === 'day' && dayNumber && [15, 30, 50, 70, 94].includes(dayNumber)) {
        isGateDay = true
        gateDayNumber = dayNumber
      }

      const questions = block.questions.map((q) => ({
        questionId: q.questionId,
        questionTitle: q.questionTitle,
        questionType: q.questionType,
        required: q.required,
        description: q.description,
        choices: q.choices,
      }))

      const title = block.dayLabel
        ? `${block.dayLabel}: ${block.theme || block.blockKey}`
        : block.blockKey

      const defData: Record<string, any> = {
        title,
        blockType,
        blockKey: block.blockKey,
        dayNumber,
        track: 'GENERAL',
        personality: 'ALL',
        weekNumber: Math.floor(block.week),
        theme: block.theme || undefined,
        deliverable: block.deliverable || undefined,
        autoCheckCriteria: block.autoCheck || undefined,
        isGateDay,
        gateDayNumber,
        questions,
      }

      // Remove undefined values
      Object.keys(defData).forEach((k) => {
        if (defData[k] === undefined) delete defData[k]
      })

      // Upsert DayDefinition by blockKey
      const existing = await payload.find({
        collection: 'day-definitions',
        where: { blockKey: { equals: block.blockKey } },
        limit: 1,
      })

      let ddId: string | number
      if (existing.totalDocs > 0) {
        const updated = await payload.update({
          collection: 'day-definitions',
          id: existing.docs[0].id,
          data: defData,
        })
        ddId = updated.id
        stats.defsUpdated++
      } else {
        const created = await (payload as any).create({
          collection: 'day-definitions',
          data: defData,
        })
        ddId = created.id
        stats.defsCreated++
      }

      // Generate FounderForm for this block
      const slug = `daily-${block.blockKey.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

      const formQuestions = block.questions.map((q) => {
        const mapped: any = {
          question_id: q.questionId,
          question_text: q.questionTitle,
          question_type: mapToFounderFormType(q.questionType),
          required: q.required,
        }

        if (q.description) mapped.helperText = q.description
        if (q.questionType === 'statement') {
          mapped.helperText = q.description || ''
          mapped.required = false
        }

        if (q.choices && (q.questionType === 'multiple_choice' || q.questionType === 'dropdown')) {
          mapped.choices = q.choices.split('|').map((c: string) => ({
            label: c.trim(),
            value: c.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
          }))
        }

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

      const sectionDesc = [block.deliverable, block.autoCheck].filter(Boolean).join('\n\nAuto-check: ') || undefined

      const formData: any = {
        title: block.dayLabel || block.blockKey,
        slug,
        allowMultipleSubmissions: true,
        sections: [
          {
            id: block.blockKey,
            title: block.dayLabel || block.blockKey,
            description: sectionDesc,
            questions: formQuestions,
          },
        ],
      }

      const existingForm = await payload.find({
        collection: 'founder-forms',
        where: { slug: { equals: slug } },
        limit: 1,
      })

      let formId: string | number
      if (existingForm.totalDocs > 0) {
        const up = await payload.update({
          collection: 'founder-forms',
          id: existingForm.docs[0].id,
          data: formData,
        })
        formId = up.id
        stats.formsUpdated++
      } else {
        const cr = await payload.create({
          collection: 'founder-forms',
          data: formData,
        })
        formId = cr.id
        stats.formsCreated++
      }

      // Link form back to DayDefinition
      await payload.update({
        collection: 'day-definitions',
        id: ddId,
        data: { linkedForm: formId },
      })
    } catch (err: any) {
      stats.errors.push(`${block.blockKey}: ${err.message || String(err)}`)
    }
  }

  return NextResponse.json({
    success: true,
    totalBlocks: blocks.length,
    dayDefinitions: {
      created: stats.defsCreated,
      updated: stats.defsUpdated,
    },
    founderForms: {
      created: stats.formsCreated,
      updated: stats.formsUpdated,
    },
    errors: stats.errors.length > 0 ? stats.errors : undefined,
    message: `Imported ${blocks.length} blocks: ${stats.defsCreated} new + ${stats.defsUpdated} updated DayDefinitions, ${stats.formsCreated} new + ${stats.formsUpdated} updated FounderForms.`,
  })
}
