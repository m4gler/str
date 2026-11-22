import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'
import { createPostgresPoolConfig, getPostgresConnectionUrl } from '../lib/postgresConfig.ts'

type SpecRow = {
  section: string
  questionId: string
  questionType: string
  required: boolean
}

type DbQuestionRow = {
  rowId: string
  questionId: string
  questionType: string
  required: boolean
}

const SPEC_PATH = path.join(process.cwd(), 'MESGA 100 Days Acc OS', 'FOUNDER_FORM_Startup_Verticals.md')

// The active founder intake form still uses several legacy IDs. Keep them mapped
// to the current spec so required-flag sync stays safe without renaming live data.
const LEGACY_TO_SPEC_ID: Record<string, string> = {
  F3_FUNCTIONAL_STR: 'F3_FUNCTIONAL_STRENGTH',
  F3_PREV_STARTUP_OUTCOME: 'F3_PREV_STARTUP_STATUS',
  F3B_TIME_CHANGE_3MO: 'F3B_TIME_CHANGE_90D',
  F3B_COMMITMENT_PLAN: 'F3B_COMMITMENT_STYLE',
  F7A_INDUSTRY_GEN: 'F7A_INDUSTRY_GENERAL',
  F7A_TARGET_USER: 'F7A_TARGET_USER_BUYER',
  F7A_FUNDING_PLAN: 'F7A_FUNDING_PLAN_12MO',
  F7B_INDUSTRY_GEN: 'F7B_INDUSTRY_GENERAL',
  F7B_TARGET_ROUND: 'F7B_TARGET_ROUND_SIZE',
  F7C_INDUSTRY_GEN: 'F7C_INDUSTRY_GENERAL',
}

function parseSpecRows(markdown: string): SpecRow[] {
  const rows: SpecRow[] = []
  const lines = markdown.split(/\r?\n/)
  let inFormSheet = false
  let sawHeader = false

  for (const line of lines) {
    if (line.startsWith('## Sheet: FORM_FOUNDER')) {
      inFormSheet = true
      continue
    }

    if (!inFormSheet) continue
    if (line.startsWith('## Sheet: ') && !line.startsWith('## Sheet: FORM_FOUNDER')) break
    if (!line.trim().startsWith('|')) continue

    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim())
    if (!sawHeader) {
      if (cells[0] === 'section' && cells[1] === 'question_id') sawHeader = true
      continue
    }

    if (cells[0] === '---') continue

    const [section, questionId, questionType, required] = cells
    if (!questionId || questionId === 'question_id' || questionType === 'admin_only') continue

    rows.push({
      section,
      questionId,
      questionType,
      required: required === 'Y',
    })
  }

  return rows
}

function getDbConfig() {
  const rawUrl = getPostgresConnectionUrl(
    {
      POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL,
      POSTGRES_URL: process.env.POSTGRES_URL,
      POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING,
      DATABASE_URL: process.env.DATABASE_URL,
    },
    ['POSTGRES_PRISMA_URL', 'POSTGRES_URL_NON_POOLING', 'POSTGRES_URL', 'DATABASE_URL'],
  )

  return createPostgresPoolConfig(rawUrl)
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  if (!fs.existsSync(SPEC_PATH)) {
    throw new Error(`Spec file not found: ${SPEC_PATH}`)
  }

  const specRows = parseSpecRows(fs.readFileSync(SPEC_PATH, 'utf8'))
  const specMap = new Map(specRows.map((row) => [row.questionId, row]))

  const client = new Client(getDbConfig())
  await client.connect()

  try {
    const activeFormRes = await client.query<{
      active_founder_form_id: number | null
    }>('select active_founder_form_id from platform_settings limit 1')

    const activeFormId = activeFormRes.rows[0]?.active_founder_form_id
    if (!activeFormId) {
      throw new Error('No active founder form configured in platform_settings.')
    }

    const questionsRes = await client.query<DbQuestionRow>(
      `
        select
          q.id as "rowId",
          q.question_id as "questionId",
          q.question_type::text as "questionType",
          coalesce(q.required, false) as "required"
        from founder_forms_sections_questions q
        join founder_forms_sections s on s.id = q._parent_id
        where s._parent_id = $1
        order by q.question_id
      `,
      [activeFormId],
    )

    const updates: Array<{ rowId: string; questionId: string; from: boolean; to: boolean }> = []
    const extraInDb: string[] = []

    for (const row of questionsRes.rows) {
      const specId = LEGACY_TO_SPEC_ID[row.questionId] || row.questionId
      const spec = specMap.get(specId)
      if (!spec) {
        extraInDb.push(row.questionId)
        continue
      }

      if (row.required !== spec.required) {
        updates.push({
          rowId: row.rowId,
          questionId: row.questionId,
          from: row.required,
          to: spec.required,
        })
      }
    }

    const dbIds = new Set(questionsRes.rows.map((row) => row.questionId))
    const missingFromDb = specRows
      .filter((row) => !row.questionId.startsWith('ADMIN_'))
      .filter((row) => !dbIds.has(row.questionId) && !Object.values(LEGACY_TO_SPEC_ID).includes(row.questionId))
      .map((row) => row.questionId)

    if (!dryRun) {
      await client.query('begin')

      for (const update of updates) {
        await client.query(
          'update founder_forms_sections_questions set required = $1 where id = $2',
          [update.to, update.rowId],
        )
      }

      await client.query('commit')
    }

    console.log(
      JSON.stringify(
        {
          dryRun,
          specQuestionCount: specRows.length,
          dbQuestionCount: questionsRes.rows.length,
          updates,
          extraInDb,
          missingFromDb,
        },
        null,
        2,
      ),
    )
  } catch (error) {
    if (!dryRun) {
      await client.query('rollback').catch(() => null)
    }
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
