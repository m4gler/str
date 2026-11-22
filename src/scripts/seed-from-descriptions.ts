import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import { getPayload } from 'payload'
import config from '@/payload.config'

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

  const reviewStartIdx = lines.findIndex((line) => line.startsWith('## Sheet: Review'))
  const importReadyIdx = lines.findIndex((line) => line.startsWith('## Sheet: Import Ready'))

  if (reviewStartIdx === -1) {
    throw new Error('Could not find "## Sheet: Review" section in file')
  }

  const sectionLines = lines.slice(
    reviewStartIdx + 1,
    importReadyIdx > 0 ? importReadyIdx : undefined,
  )

  const headerIdx = sectionLines.findIndex((line) => line.startsWith('| BLOCK'))
  if (headerIdx === -1) {
    throw new Error('Could not find table header in Review section')
  }

  const dataLines = sectionLines.slice(headerIdx + 2)
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

  const results: ParsedRow[] = []

  for (const rawRow of rawRows) {
    const firstLine = rawRow.split('\n')[0]
    const pipePositions: number[] = []

    for (let i = 0; i < firstLine.length; i++) {
      if (firstLine[i] === '|') pipePositions.push(i)
    }

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

    let newDesc = firstLine.substring(pipePositions[10] + 1).trim()
    const restLines = rawRow.split('\n').slice(1)
    if (restLines.length > 0) {
      const continuation = restLines.join('\n').replace(/\|\s*$/, '').trim()
      if (continuation) {
        newDesc = `${newDesc}\n${continuation}`
      }
    }

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
    if (row.deliverable && !block.deliverable) block.deliverable = row.deliverable
    if (row.autoCheck && !block.autoCheck) block.autoCheck = row.autoCheck
    if (row.theme && !block.theme) block.theme = row.theme

    const isStatement = row.type === 'statement'
    const isOptional = row.questionTitle.toLowerCase().includes('(optional)')
    const isRequired = !isStatement && !isOptional

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

async function seed() {
  const dryRun = process.argv.includes('--dry-run')
  const deletePrevious = process.argv.includes('--delete-previous')
  const payload = await getPayload({ config })

  const mdPath = path.join(
    process.cwd(),
    'MESGA 100 Days Acc OS',
    'MESGA_100Days_Descriptions.md',
  )

  if (!fs.existsSync(mdPath)) {
    throw new Error(`File not found: ${mdPath}`)
  }

  const content = fs.readFileSync(mdPath, 'utf-8')
  const parsedRows = parseReviewSheet(content)
  const blocks = groupByBlock(parsedRows)

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          totalRows: parsedRows.length,
          totalBlocks: blocks.length,
          preworkBlocks: blocks.filter((block) => block.blockKey.startsWith('PREWORK-')).length,
          dayBlocks: blocks.filter((block) => block.blockKey.startsWith('DAY-')).length,
          sampleBlock: blocks[0],
          sampleLastBlock: blocks[blocks.length - 1],
        },
        null,
        2,
      ),
    )
    process.exit(0)
  }

  if (deletePrevious) {
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

    const oldDefs = await payload.find({
      collection: 'day-definitions',
      limit: 500,
      depth: 0,
    })

    for (const definition of oldDefs.docs) {
      await payload.delete({ collection: 'day-definitions', id: definition.id })
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
      const statementQuestion = block.questions.find((question) => question.questionType === 'statement')
      const existingDefinition = await payload.find({
        collection: 'day-definitions',
        where: { blockKey: { equals: block.blockKey } },
        limit: 1,
        depth: 0,
      })

      const existingTitle =
        existingDefinition.totalDocs > 0 ? (existingDefinition.docs[0] as any).title : undefined

      const isGateDay =
        blockType === 'day' && dayNumber != null && [15, 30, 50, 70, 94].includes(dayNumber)

      const definitionData: Record<string, any> = {
        title: existingTitle || block.dayLabel || statementQuestion?.questionTitle || block.blockKey,
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
        ...(isGateDay ? { gateDayNumber: dayNumber } : {}),
        questions: block.questions.map((question) => ({
          questionId: question.questionId,
          questionTitle: question.questionTitle,
          questionType: question.questionType,
          required: question.required,
          description: question.description,
          ...(question.choices ? { choices: question.choices } : {}),
        })),
      }

      Object.keys(definitionData).forEach((key) => {
        if (definitionData[key] === undefined) delete definitionData[key]
      })

      let definitionId: string | number
      if (existingDefinition.totalDocs > 0) {
        const updated = await payload.update({
          collection: 'day-definitions',
          id: existingDefinition.docs[0].id,
          data: definitionData as any,
        })
        definitionId = updated.id
        stats.defsUpdated++
      } else {
        const created = await (payload as any).create({
          collection: 'day-definitions',
          data: definitionData as any,
        })
        definitionId = created.id
        stats.defsCreated++
      }

      const slug = `daily-${block.blockKey.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
      const existingForm = await payload.find({
        collection: 'founder-forms',
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 0,
      })

      const formQuestions = block.questions.map((question) => {
        const mapped: Record<string, any> = {
          question_id: question.questionId,
          question_text: question.questionTitle,
          question_type: mapToFounderFormType(question.questionType),
          required: question.required,
        }

        if (question.description) mapped.helperText = question.description
        if (question.questionType === 'statement') mapped.required = false

        if (question.choices && (question.questionType === 'multiple_choice' || question.questionType === 'dropdown')) {
          mapped.choices = question.choices.split('|').map((choice) => ({
            label: choice.trim(),
            value: choice.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
          }))
        }

        if (question.questionType === 'opinion_scale') {
          const rangeMatch = (question.questionTitle || '').match(/\((\d+)[–-](\d+)\)/)
          const rangeStart = rangeMatch ? parseInt(rangeMatch[1], 10) : 0
          const rangeEnd = rangeMatch ? parseInt(rangeMatch[2], 10) : 5
          mapped.choices = Array.from({ length: rangeEnd - rangeStart + 1 }, (_, index) => ({
            label: String(rangeStart + index),
            value: String(rangeStart + index),
          }))
        }

        return mapped
      })

      const sectionTitle =
        statementQuestion?.questionTitle || block.dayLabel || block.blockKey
      const sectionDescription =
        [block.deliverable, block.autoCheck]
          .filter(Boolean)
          .join('\n\nAuto-check: ') || undefined

      const formData = {
        title: sectionTitle,
        allowMultipleSubmissions: true,
        sections: [
          {
            id: block.blockKey,
            title: sectionTitle,
            ...(sectionDescription ? { description: sectionDescription } : {}),
            questions: formQuestions,
          },
        ],
      }

      let formId: string | number
      if (existingForm.totalDocs > 0) {
        const updated = await payload.update({
          collection: 'founder-forms',
          id: existingForm.docs[0].id,
          data: formData as any,
        })
        formId = updated.id
        stats.formsUpdated++
      } else {
        const created = await payload.create({
          collection: 'founder-forms',
          data: {
            ...(formData as any),
            slug,
          } as any,
        })
        formId = created.id
        stats.formsCreated++
      }

      await payload.update({
        collection: 'day-definitions',
        id: definitionId,
        data: { linkedForm: formId },
      })
    } catch (error: any) {
      stats.errors.push(`${block.blockKey}: ${error.message || String(error)}`)
    }
  }

  console.log(
    JSON.stringify(
      {
        success: stats.errors.length === 0,
        totalBlocks: blocks.length,
        dayDefinitions: {
          created: stats.defsCreated,
          updated: stats.defsUpdated,
        },
        founderForms: {
          created: stats.formsCreated,
          updated: stats.formsUpdated,
        },
        errors: stats.errors,
      },
      null,
      2,
    ),
  )

  process.exit(stats.errors.length > 0 ? 1 : 0)
}

seed().catch((error) => {
  console.error('seed-from-descriptions failed:', error)
  process.exit(1)
})
