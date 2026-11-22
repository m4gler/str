import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'
import { normalizeEstimatedTimeHrs } from '@/lib/estimatedTime'
import {
  buildDefinitionKey,
  CANONICAL_ARCHETYPES,
  CURRICULUM_DEFAULT_RELEASE_KEY,
  CURRICULUM_DEV_NOTE_SHEET,
  CURRICULUM_GENERAL_SHEET,
  CURRICULUM_GENERAL_TEST_SHEET,
  CURRICULUM_META_SHEET,
  CURRICULUM_PERSONALITY_GUIDE_SHEET,
  CURRICULUM_SNAPSHOT_DIR,
  CURRICULUM_SNAPSHOT_JSON,
  CURRICULUM_SOURCE_DEFAULT_PATH,
  CURRICULUM_VERTICAL_SHEET_LABELS,
  CURRICULUM_VERTICAL_SHEETS,
  GENERAL_DIMENSION_VALUE,
  getArchetypeAliases,
  PERSONALITY_VARIANT_MARKER,
  TRACK_VARIANT_MARKER,
  VERTICAL_VARIANT_MARKER,
  normalizeArchetypeKey,
  normalizeVariantTrackLabel,
  normalizeVerticalLabel,
} from './constants'

const MERGEABLE_FIELDS = [
  'title',
  'theme',
  'founderCommandment',
  'activity',
  'deliverable',
  'exampleProject',
  'whereHowTips',
  'mesgaIntegration',
  'estimatedTimeHrs',
  'eduDescription',
  'eduLinks',
  'coachingNote',
  'qaTimeBreakdown',
] as const

type MergeableField = (typeof MERGEABLE_FIELDS)[number]

type MasterRow = {
  day: number
  verticalMarker: string
  personalityMarker: string
  trackMarker: string
  theme: string | null
  founderCommandment: string | null
  activity: string | null
  estimatedTimeHrs: number | null
  deliverable: string | null
  exampleProject: string | null
  tips: string | null
  linkResource: string | null
  summaryNote: string | null
  mesgaIntegration: string | null
  qaTimeBreakdown: string | null
  sourceRowNumber: number
}

export type CurriculumDefinitionRecord = {
  definitionKind: 'base' | 'override'
  definitionKey: string
  releaseKey: string
  blockKey: string
  blockType: 'day' | 'prework' | 'gate' | 'weekly'
  dayNumber: number
  order: number
  weekNumber: number
  title: string | null
  vertical: string
  personality: string
  track: string
  hasVerticalVariants?: boolean
  hasPersonalityVariants?: boolean
  hasTrackVariants?: boolean
  sourceSheet: string
  sourceRowNumber: number
  qaSourceSheet?: string
  qaSourceRowNumber?: number
  overrideFields?: Partial<Record<MergeableField, unknown>>
  theme?: string | null
  founderCommandment?: string | null
  activity?: string | null
  deliverable?: string | null
  exampleProject?: string | null
  whereHowTips?: string | null
  mesgaIntegration?: string | null
  estimatedTimeHrs?: number | null
  eduDescription?: string | null
  eduLinks?: Array<{ label: string; url: string; type?: string }>
  coachingNote?: string | null
  qaTimeBreakdown?: string | null
  divergenceNotes?: Array<{ type: string; text: string }>
}

export type CurriculumSnapshot = {
  generatedAt: string
  sourceFilePath: string
  sourceSignature: string
  releaseKey: string
  meta: {
    version: string
    date: string
    owner: string
    contact: string
  }
  sheetNames: string[]
  availableVerticals: string[]
  availableArchetypes: string[]
  baseDefinitions: CurriculumDefinitionRecord[]
  overrideDefinitions: CurriculumDefinitionRecord[]
  archetypeGuide: {
    archetypes: Array<{ key: string; emoji: string; tagline: string }>
    coachingDays: Array<{ day: number; theme: string }>
  }
}

function getCell(ws: XLSX.WorkSheet, rowIndex: number, colIndex: number): XLSX.CellObject | undefined {
  const addr = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })
  return ws[addr]
}

function isSingleCellReferenceFormula(formula: unknown): boolean {
  if (typeof formula !== 'string') return false
  return /^(?:'[^']+'|[A-Za-z0-9_ &]+)![A-Z]+[0-9]+$/u.test(formula.trim())
}

function isBlankFormulaReferenceCell(cell: XLSX.CellObject | undefined): boolean {
  const rawCell = cell as any
  if (!rawCell?.f || !isSingleCellReferenceFormula(rawCell.f)) return false
  return (rawCell.v === 0 || rawCell.v === '0') && String(rawCell.w ?? '').trim() === '0'
}

function extractCellComments(ws: XLSX.WorkSheet, rowIndex: number, maxCol = 14): Array<{ type: string; text: string }> {
  const seen = new Set<string>()
  const notes: Array<{ type: string; text: string }> = []

  for (let col = 0; col < maxCol; col++) {
    const cell = getCell(ws, rowIndex, col) as any
    const comments: any[] = cell?.c
    if (!comments || !Array.isArray(comments)) continue

    for (const comment of comments) {
      const text = String(comment?.t || '').trim()
      if (!text || seen.has(text)) continue
      seen.add(text)

      let type = 'note'
      const upper = text.toUpperCase()
      if (upper.includes('VERTICAL DIVERGENCE')) type = 'vertical'
      else if (upper.includes('PERSONALITY DIVERGENCE')) type = 'personality'
      else if (upper.includes('TRACK INJECTION')) type = 'track'

      notes.push({ type, text })
    }
  }

  return notes
}

function getCellRawValue(ws: XLSX.WorkSheet, rowIndex: number, colIndex: number): string | number | null {
  const cell = getCell(ws, rowIndex, colIndex)
  if (!cell) return null
  if (isBlankFormulaReferenceCell(cell)) return null
  return (cell.v ?? cell.w ?? null) as string | number | null
}

function getCellDisplayValue(ws: XLSX.WorkSheet, rowIndex: number, colIndex: number): string | null {
  const cell = getCell(ws, rowIndex, colIndex)
  if (!cell) return null
  if (isBlankFormulaReferenceCell(cell)) return null
  const raw = cell.w ?? cell.v ?? null
  if (raw == null) return null
  return String(raw).trim() || null
}

function parseNumericValue(value: string | number | null): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const numeric = Number(trimmed.replace(/[^0-9.-]+/g, ''))
    if (Number.isFinite(numeric)) return numeric
  }
  return null
}

function normalizeTextValue(value: string | null): string | null {
  const text = String(value || '').replace(/\r/g, '').trim()
  return text ? text : null
}

function extractFirstUrl(value: string | null): string | null {
  if (!value) return null
  const match = value.match(/https?:\/\/[^\s|]+/i)
  return match?.[0] ?? null
}

function buildEduLinks(linkResource: string | null): Array<{ label: string; url: string; type?: string }> {
  const url = extractFirstUrl(linkResource)
  if (!url) return []
  return [{ label: 'Resource', url, type: 'other' }]
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

function getMasterHeaderRow(ws: XLSX.WorkSheet): number | null {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  const maxHeaderRow = Math.min(range.e.r, 4)

  for (let rowIndex = range.s.r; rowIndex <= maxHeaderRow; rowIndex++) {
    const a = String(getCellDisplayValue(ws, rowIndex, 0) || '').toUpperCase()
    const b = String(getCellDisplayValue(ws, rowIndex, 1) || '').toUpperCase()
    const d = String(getCellDisplayValue(ws, rowIndex, 3) || '').toUpperCase()

    if (a.includes('DAY') && b.includes('VERTICAL') && d.includes('TRACK')) {
      return rowIndex
    }
  }

  return null
}

function parseMasterSheetRows(
  ws: XLSX.WorkSheet,
  options: {
    headerRowIndex: number
    fallbackWs?: XLSX.WorkSheet
    fallbackRowOffset?: number
  },
): MasterRow[] {
  const rows: MasterRow[] = []
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  const { headerRowIndex, fallbackWs, fallbackRowOffset = 0 } = options

  for (let rowIndex = headerRowIndex + 1; rowIndex <= range.e.r; rowIndex++) {
    const fallbackRowIndex = rowIndex - fallbackRowOffset
    const rawDay = parseNumericValue(getCellRawValue(ws, rowIndex, 0))
      ?? (fallbackWs ? parseNumericValue(getCellRawValue(fallbackWs, fallbackRowIndex, 0)) : null)

    if (!rawDay || rawDay < 1) continue

    const readText = (colIndex: number) => {
      const directCell = getCell(ws, rowIndex, colIndex)
      const direct = isBlankFormulaReferenceCell(directCell) ? null : getCellDisplayValue(ws, rowIndex, colIndex)
      if (direct != null) return direct
      if (!fallbackWs || fallbackRowIndex < 0) return null
      return getCellDisplayValue(fallbackWs, fallbackRowIndex, colIndex)
    }

    const readNumber = (colIndex: number) => {
      const directCell = getCell(ws, rowIndex, colIndex)
      const direct = isBlankFormulaReferenceCell(directCell) ? null : parseNumericValue(getCellRawValue(ws, rowIndex, colIndex))
      if (direct != null) return direct
      if (!fallbackWs || fallbackRowIndex < 0) return null
      return parseNumericValue(getCellRawValue(fallbackWs, fallbackRowIndex, colIndex))
    }

    rows.push({
      day: Math.floor(rawDay),
      verticalMarker: readText(1) || GENERAL_DIMENSION_VALUE,
      personalityMarker: readText(2) || GENERAL_DIMENSION_VALUE,
      trackMarker: readText(3) || GENERAL_DIMENSION_VALUE,
      theme: normalizeTextValue(readText(4)),
      founderCommandment: normalizeTextValue(readText(5)),
      activity: normalizeTextValue(readText(6)),
      estimatedTimeHrs: normalizeEstimatedTimeHrs(readNumber(7)),
      deliverable: normalizeTextValue(readText(8)),
      exampleProject: normalizeTextValue(readText(12)),
      tips: normalizeTextValue(readText(9)),
      linkResource: normalizeTextValue(readText(10)),
      summaryNote: normalizeTextValue(readText(11)),
      mesgaIntegration: normalizeTextValue(readText(13)),
      qaTimeBreakdown: normalizeTextValue(readText(7)),
      sourceRowNumber: rowIndex + 1,
    })
  }

  return rows
}

function buildBaseDefinitions(
  releaseKey: string,
  generalRows: MasterRow[],
  qaRowsByDay: Map<number, MasterRow>,
  generalSheet?: XLSX.WorkSheet,
): CurriculumDefinitionRecord[] {
  return generalRows.map((row) => {
    const blockKey = `DAY-BLOCK-${row.day}`
    const qaRow = qaRowsByDay.get(row.day)
    const divergenceNotes = generalSheet
      ? extractCellComments(generalSheet, row.sourceRowNumber - 1)
      : []
    return {
      definitionKind: 'base',
      definitionKey: buildDefinitionKey({ releaseKey, blockKey }),
      releaseKey,
      blockKey,
      blockType: 'day',
      dayNumber: row.day,
      order: row.day,
      weekNumber: Math.ceil(row.day / 7),
      title: row.activity || `Day ${row.day}`,
      vertical: GENERAL_DIMENSION_VALUE,
      personality: GENERAL_DIMENSION_VALUE,
      track: GENERAL_DIMENSION_VALUE,
      hasVerticalVariants: row.verticalMarker === VERTICAL_VARIANT_MARKER,
      hasPersonalityVariants: row.personalityMarker === PERSONALITY_VARIANT_MARKER,
      hasTrackVariants: row.trackMarker === TRACK_VARIANT_MARKER,
      sourceSheet: CURRICULUM_GENERAL_SHEET,
      sourceRowNumber: row.sourceRowNumber,
      qaSourceSheet: qaRow ? CURRICULUM_GENERAL_TEST_SHEET : undefined,
      qaSourceRowNumber: qaRow?.sourceRowNumber,
      theme: row.theme,
      founderCommandment: row.founderCommandment,
      activity: row.activity,
      deliverable: row.deliverable,
      exampleProject: row.exampleProject,
      whereHowTips: row.tips,
      mesgaIntegration: row.mesgaIntegration,
      estimatedTimeHrs: row.estimatedTimeHrs,
      eduDescription: row.summaryNote,
      eduLinks: buildEduLinks(row.linkResource),
      qaTimeBreakdown: qaRow?.qaTimeBreakdown ?? null,
      divergenceNotes: divergenceNotes.length > 0 ? divergenceNotes : undefined,
    }
  })
}

function buildOverridePatch(
  baseDefinition: CurriculumDefinitionRecord,
  row: MasterRow,
  extraFields?: Partial<Record<MergeableField, unknown>>,
): Partial<Record<MergeableField, unknown>> {
  const candidate: Partial<Record<MergeableField, unknown>> = {
    title: row.activity || `Day ${row.day}`,
    theme: row.theme,
    founderCommandment: row.founderCommandment,
    activity: row.activity,
    deliverable: row.deliverable,
    exampleProject: row.exampleProject,
    whereHowTips: row.tips,
    mesgaIntegration: row.mesgaIntegration,
    estimatedTimeHrs: row.estimatedTimeHrs,
    eduDescription: row.summaryNote,
    eduLinks: buildEduLinks(row.linkResource),
    ...extraFields,
  }

  const patch: Partial<Record<MergeableField, unknown>> = {}

  for (const field of MERGEABLE_FIELDS) {
    if (!(field in candidate)) continue
    if (!valuesEqual(candidate[field], baseDefinition[field])) {
      patch[field] = candidate[field]
    }
  }

  return patch
}

function buildVerticalOverrides(
  releaseKey: string,
  workbook: XLSX.WorkBook,
  generalRows: MasterRow[],
  baseDefinitions: CurriculumDefinitionRecord[],
): CurriculumDefinitionRecord[] {
  const generalSheet = workbook.Sheets[CURRICULUM_GENERAL_SHEET]
  const generalHeaderRowIndex = generalSheet ? getMasterHeaderRow(generalSheet) ?? 0 : 0
  const baseByDay = new Map(baseDefinitions.map((definition) => [definition.dayNumber, definition]))
  const overrides: CurriculumDefinitionRecord[] = []

  for (const sheetName of CURRICULUM_VERTICAL_SHEETS) {
    const ws = workbook.Sheets[sheetName]
    if (!ws) continue

    const headerRowIndex = getMasterHeaderRow(ws)
    if (headerRowIndex == null || !generalSheet) continue

    const vertical = CURRICULUM_VERTICAL_SHEET_LABELS[sheetName]
    const parsedRows = parseMasterSheetRows(ws, {
      headerRowIndex,
      fallbackWs: generalSheet,
      fallbackRowOffset: headerRowIndex - generalHeaderRowIndex,
    })

    for (const row of parsedRows) {
      const baseDefinition = baseByDay.get(row.day)
      if (!baseDefinition) continue

      const patch = buildOverridePatch(baseDefinition, row)
      if (Object.keys(patch).length === 0) continue

      overrides.push({
        definitionKind: 'override',
        definitionKey: buildDefinitionKey({ releaseKey, blockKey: baseDefinition.blockKey, vertical }),
        releaseKey,
        blockKey: baseDefinition.blockKey,
        blockType: 'day',
        dayNumber: baseDefinition.dayNumber,
        order: baseDefinition.order,
        weekNumber: baseDefinition.weekNumber,
        title: patch.title as string | null,
        vertical,
        personality: GENERAL_DIMENSION_VALUE,
        track: GENERAL_DIMENSION_VALUE,
        sourceSheet: sheetName,
        sourceRowNumber: row.sourceRowNumber,
        overrideFields: patch,
      })
    }
  }

  return overrides
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function splitSupportNotes(value: string | null, supportKeys: string[]): Record<string, string> {
  const text = normalizeTextValue(value)
  if (!text || supportKeys.length === 0) return {}

  const aliases = Array.from(new Set(
    supportKeys
      .flatMap((key) => getArchetypeAliases(key))
      .sort((left, right) => right.length - left.length),
  ))
  if (aliases.length === 0) return {}

  const labelPattern = aliases.map((alias) => escapeRegExp(alias)).join('|')
  const labelRegex = new RegExp(`((?:[^\\p{L}\\p{N}]*)?(?:${labelPattern}))\\s*:`, 'giu')
  const matches = Array.from(text.matchAll(labelRegex))
    .map((match) => {
      const canonicalKey = normalizeArchetypeKey(match[1])
      return canonicalKey && supportKeys.includes(canonicalKey)
        ? { canonicalKey, start: match.index ?? 0, contentStart: (match.index ?? 0) + match[0].length }
        : null
    })
    .filter((match): match is { canonicalKey: string; start: number; contentStart: number } => Boolean(match))

  const notes: Record<string, string> = {}

  for (let index = 0; index < matches.length; index++) {
    const current = matches[index]
    const end = matches[index + 1]?.start ?? text.length
    const note = text.slice(current.contentStart, end).trim()
    if (note) notes[current.canonicalKey] = note
  }

  return notes
}

function findPersonalityGuideHeaderRow(rows: string[][]): number | null {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 40); rowIndex++) {
    const row = rows[rowIndex] || []
    const firstCell = normalizeTextValue(String(row[0] || ''))?.toUpperCase()
    const secondCell = normalizeTextValue(String(row[1] || ''))?.toUpperCase()

    if (firstCell === 'DAY' && secondCell === 'THEME') {
      return rowIndex
    }
  }

  return null
}

function parseSupportNotesHeader(headerText: string): string[] | null {
  if (!/support notes?/iu.test(headerText)) return null

  const cleaned = headerText
    .replace(/\(support notes?\)/giu, '')
    .replace(/\n/g, ' ')
    .trim()

  const parts = cleaned
    .split('/')
    .map((part) => normalizeArchetypeKey(part))
    .filter((part) => part && part !== GENERAL_DIMENSION_VALUE)

  return parts.length >= 2 ? Array.from(new Set(parts)) : null
}

function readPersonalityGuideColumns(headerRow: string[]) {
  const canonicalKeys = new Set(CANONICAL_ARCHETYPES.map((archetype) => archetype.key))
  const canonicalColumns = new Map<string, number>()
  let supportNotesColumn: number | null = null
  let supportNoteKeys: string[] = []

  for (let colIndex = 2; colIndex < headerRow.length; colIndex++) {
    const headerText = normalizeTextValue(String(headerRow[colIndex] || '').replace(/\n/g, ' '))
    if (!headerText) continue

    const supportKeys = parseSupportNotesHeader(headerText)
    if (supportKeys) {
      supportNotesColumn = colIndex
      supportNoteKeys = supportKeys
      continue
    }

    const normalized = normalizeArchetypeKey(headerText)
    if (canonicalKeys.has(normalized) && !canonicalColumns.has(normalized)) {
      canonicalColumns.set(normalized, colIndex)
    }
  }

  return { canonicalColumns, supportNotesColumn, supportNoteKeys }
}

function buildPersonalityOverrides(
  releaseKey: string,
  workbook: XLSX.WorkBook,
  baseDefinitions: CurriculumDefinitionRecord[],
): CurriculumDefinitionRecord[] {
  const ws = workbook.Sheets[CURRICULUM_PERSONALITY_GUIDE_SHEET]
  if (!ws) return []

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]
  const baseByDay = new Map(baseDefinitions.map((definition) => [definition.dayNumber, definition]))
  const overrides: CurriculumDefinitionRecord[] = []
  const headerRowIndex = findPersonalityGuideHeaderRow(rows)
  if (headerRowIndex == null) return []

  const { canonicalColumns, supportNotesColumn, supportNoteKeys } = readPersonalityGuideColumns(rows[headerRowIndex] || [])

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex] || []
    const day = parseNumericValue((row[0] as string | number | undefined) ?? null)
    if (!day) continue

    const baseDefinition = baseByDay.get(Math.floor(day))
    if (!baseDefinition) continue

    const noteColumns = Array.from(canonicalColumns.entries()).map(([personality, colIndex]) => ({
      personality,
      note: normalizeTextValue(String(row[colIndex] || '')),
    }))

    if (supportNotesColumn != null) {
      const supportNotes = splitSupportNotes(String(row[supportNotesColumn] || ''), supportNoteKeys)

      for (const personality of supportNoteKeys) {
        if (!canonicalColumns.has(personality)) {
          noteColumns.push({ personality, note: supportNotes[personality] ?? null })
        }
      }
    }

    for (const noteColumn of noteColumns) {
      if (!noteColumn.note) continue

      overrides.push({
        definitionKind: 'override',
        definitionKey: buildDefinitionKey({
          releaseKey,
          blockKey: baseDefinition.blockKey,
          personality: noteColumn.personality,
        }),
        releaseKey,
        blockKey: baseDefinition.blockKey,
        blockType: 'day',
        dayNumber: baseDefinition.dayNumber,
        order: baseDefinition.order,
        weekNumber: baseDefinition.weekNumber,
        title: baseDefinition.title,
        vertical: GENERAL_DIMENSION_VALUE,
        personality: normalizeArchetypeKey(noteColumn.personality),
        track: GENERAL_DIMENSION_VALUE,
        sourceSheet: CURRICULUM_PERSONALITY_GUIDE_SHEET,
        sourceRowNumber: rowIndex + 1,
        overrideFields: { coachingNote: noteColumn.note },
      })
    }
  }

  return overrides
}

function readMeta(workbook: XLSX.WorkBook) {
  const ws = workbook.Sheets[CURRICULUM_META_SHEET]
  if (!ws) {
    return {
      version: CURRICULUM_DEFAULT_RELEASE_KEY,
      date: '',
      owner: '',
      contact: '',
    }
  }

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]
  const lookup = new Map<string, string>()

  for (const row of rows) {
    const key = String(row[0] || '').trim()
    const value = String(row[1] || '').trim()
    if (key && value) lookup.set(key.toLowerCase(), value)
  }

  return {
    version: lookup.get('version') || CURRICULUM_DEFAULT_RELEASE_KEY,
    date: lookup.get('date') || '',
    owner: lookup.get('owner') || '',
    contact: lookup.get('contact') || '',
  }
}

function computeSourceSignature(filePath: string): string {
  const stat = fs.statSync(filePath)
  return `${stat.size}:${Math.floor(stat.mtimeMs)}`
}

function rowsToMarkdown(rows: Array<Array<string | number | null | undefined>>): string {
  const tableRows = rows
    .map((row) => row.map((cell) => String(cell ?? '').replace(/\|/g, '\\|').replace(/\n/g, '<br />')))
    .filter((row) => row.some((cell) => cell.trim().length > 0))

  if (tableRows.length === 0) return ''

  const columnCount = Math.max(...tableRows.map((row) => row.length))
  const normalizedRows = tableRows.map((row) => Array.from({ length: columnCount }, (_, index) => row[index] || ''))
  const header = normalizedRows[0]
  const divider = Array.from({ length: columnCount }, () => '---')
  const body = normalizedRows.slice(1)

  return [
    `| ${header.join(' | ')} |`,
    `| ${divider.join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

export function exportCurriculumMarkdownSnapshots(workbook: XLSX.WorkBook, rootDir = process.cwd()) {
  const sheetsDir = path.join(rootDir, CURRICULUM_SNAPSHOT_DIR, 'sheets')
  fs.mkdirSync(sheetsDir, { recursive: true })

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' }) as Array<Array<string | number>>
    const fileName = `${sheetName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'sheet'}.md`
    const markdown = `# ${sheetName}\n\n${rowsToMarkdown(rows)}\n`
    fs.writeFileSync(path.join(sheetsDir, fileName), markdown, 'utf8')
  }
}

export function parseCurriculumWorkbook(
  workbook: XLSX.WorkBook,
  options: { sourceFilePath?: string; sourceSignature?: string } = {},
): CurriculumSnapshot {
  const generalSheet = workbook.Sheets[CURRICULUM_GENERAL_SHEET]
  const generalTestSheet = workbook.Sheets[CURRICULUM_GENERAL_TEST_SHEET]
  const generalHeaderRowIndex = generalSheet ? getMasterHeaderRow(generalSheet) : null
  const generalTestHeaderRowIndex = generalTestSheet ? getMasterHeaderRow(generalTestSheet) : null

  if (!generalSheet || generalHeaderRowIndex == null) {
    throw new Error(`Sheet "${CURRICULUM_GENERAL_SHEET}" is missing or malformed`)
  }

  const generalRows = parseMasterSheetRows(generalSheet, {
    headerRowIndex: generalHeaderRowIndex,
  })
  const generalTestRows = generalTestSheet && generalTestHeaderRowIndex != null
    ? parseMasterSheetRows(generalTestSheet, {
        headerRowIndex: generalTestHeaderRowIndex,
        fallbackWs: generalSheet,
        fallbackRowOffset: generalTestHeaderRowIndex - generalHeaderRowIndex,
      })
    : []

  const meta = readMeta(workbook)
  const qaRowsByDay = new Map(generalTestRows.map((row) => [row.day, row]))
  const baseDefinitions = buildBaseDefinitions(meta.version, generalRows, qaRowsByDay, generalSheet)
  const verticalOverrides = buildVerticalOverrides(meta.version, workbook, generalRows, baseDefinitions)
  const personalityOverrides = buildPersonalityOverrides(meta.version, workbook, baseDefinitions)

  const personalityGuideRows = XLSX.utils.sheet_to_json(
    workbook.Sheets[CURRICULUM_PERSONALITY_GUIDE_SHEET] || {},
    { header: 1, defval: '' },
  ) as string[][]

  const coachingDays = personalityGuideRows
    .slice(20)
    .map((row) => ({
      day: Number(row[0]),
      theme: String(row[1] || '').trim(),
    }))
    .filter((row) => Number.isFinite(row.day) && row.day > 0)

  return {
    generatedAt: new Date().toISOString(),
    sourceFilePath: options.sourceFilePath || CURRICULUM_SOURCE_DEFAULT_PATH,
    sourceSignature: options.sourceSignature || '',
    releaseKey: meta.version,
    meta,
    sheetNames: workbook.SheetNames,
    availableVerticals: Object.values(CURRICULUM_VERTICAL_SHEET_LABELS),
    availableArchetypes: CANONICAL_ARCHETYPES.map((archetype) => archetype.key),
    baseDefinitions,
    overrideDefinitions: [...verticalOverrides, ...personalityOverrides],
    archetypeGuide: {
      archetypes: CANONICAL_ARCHETYPES.map(({ key, emoji, tagline }) => ({ key, emoji, tagline })),
      coachingDays,
    },
  }
}

export function writeCurriculumSnapshot(
  snapshot: CurriculumSnapshot,
  rootDir = process.cwd(),
) {
  const targetDir = path.join(rootDir, CURRICULUM_SNAPSHOT_DIR)
  fs.mkdirSync(targetDir, { recursive: true })
  fs.writeFileSync(path.join(rootDir, CURRICULUM_SNAPSHOT_JSON), JSON.stringify(snapshot, null, 2), 'utf8')
}

export function loadCurriculumSnapshot(rootDir = process.cwd()): CurriculumSnapshot | null {
  const filePath = path.join(rootDir, CURRICULUM_SNAPSHOT_JSON)
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as CurriculumSnapshot
}

export function loadCurriculumSource(options: {
  filePath?: string
  rootDir?: string
  preferSnapshot?: boolean
  refreshSnapshot?: boolean
  writeMarkdown?: boolean
} = {}): { workbook: XLSX.WorkBook | null; snapshot: CurriculumSnapshot } {
  const rootDir = options.rootDir || process.cwd()
  const filePath = path.isAbsolute(options.filePath || '')
    ? (options.filePath as string)
    : path.join(rootDir, options.filePath || CURRICULUM_SOURCE_DEFAULT_PATH)

  if (!fs.existsSync(filePath)) {
    throw new Error(`Curriculum source file not found: ${filePath}`)
  }

  const sourceSignature = computeSourceSignature(filePath)
  const cachedSnapshot = options.preferSnapshot !== false ? loadCurriculumSnapshot(rootDir) : null

  if (
    cachedSnapshot &&
    !options.refreshSnapshot &&
    cachedSnapshot.sourceFilePath === filePath &&
    cachedSnapshot.sourceSignature === sourceSignature
  ) {
    return { workbook: null, snapshot: cachedSnapshot }
  }

  const fileBuffer = fs.readFileSync(filePath)
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellFormula: true, cellNF: true, cellText: true })
  const snapshot = parseCurriculumWorkbook(workbook, {
    sourceFilePath: filePath,
    sourceSignature,
  })

  writeCurriculumSnapshot(snapshot, rootDir)

  if (options.writeMarkdown !== false) {
    exportCurriculumMarkdownSnapshots(workbook, rootDir)
  }

  return { workbook, snapshot }
}
