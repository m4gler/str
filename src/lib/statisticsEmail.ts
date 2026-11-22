export type StatisticsEmailGroup = 'all' | 'preprogram' | 'started' | 'active' | 'finished' | 'failed'

export interface StatisticsEmailRecipientRow {
  id: string
  email: string
  programTrackId?: string | null
  partnerId?: string | null
  programStatus: string
  attemptStatus: string | null
  programTrackName: string | null
  partnerName: string | null
  personality: string | null
  steps: {
    prework: boolean
    started100Days: boolean
    active100Days: boolean
    finished: boolean
    failed: boolean
  }
}

export interface StatisticsEmailRecipientFilters {
  trackId?: string
  partnerId?: string
  personality?: string
  founderId?: string
  founderIds?: string[]
}

export interface StatisticsEmailTemplateContent {
  subject: string
  body: string
}

export interface RenderedStatisticsEmail {
  subject: string
  html: string
}

export interface StatisticsEmailTemplateTarget {
  group: StatisticsEmailGroup
  trackId: string | null
  personality: string | null
  founderId: string | null
  founderIds: string[]
}

export interface StatisticsEmailAttachment {
  filename: string
  content: string
  contentType?: string | null
  size?: number | null
}

export interface StatisticsEmailSendOptions {
  to: string
  subject: string
  html: string
  attachments?: Array<{
    filename: string
    content: string
    encoding: 'base64'
    contentType?: string
  }>
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
const VALID_GROUPS = new Set<StatisticsEmailGroup>(['all', 'preprogram', 'started', 'active', 'finished', 'failed'])

const GROUP_MATCHERS: Record<StatisticsEmailGroup, (row: StatisticsEmailRecipientRow) => boolean> = {
  all: () => true,
  preprogram: (row) => row.steps.prework && !row.steps.started100Days && !row.steps.finished && !row.steps.failed,
  started: (row) => row.steps.started100Days && !row.steps.failed,
  active: (row) => row.steps.active100Days,
  finished: (row) => row.steps.finished,
  failed: (row) => row.steps.failed,
}

const VARIABLE_READERS: Record<string, (row: StatisticsEmailRecipientRow) => string> = {
  email: (row) => normalizeEmail(row.email),
  track: (row) => row.programTrackName || 'Unassigned',
  partner: (row) => row.partnerName || 'Unassigned',
  personality: (row) => row.personality || 'Unassigned',
  status: (row) => row.attemptStatus || row.programStatus || 'unknown',
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function toStatisticsEmailTemplateTarget(value: {
  group?: unknown
  trackId?: unknown
  personality?: unknown
  founderId?: unknown
  founderIds?: unknown
}): StatisticsEmailTemplateTarget {
  return {
    group: VALID_GROUPS.has(value.group as StatisticsEmailGroup) ? value.group as StatisticsEmailGroup : 'all',
    trackId: cleanNullableString(value.trackId),
    personality: cleanNullableString(value.personality),
    founderId: cleanNullableString(value.founderId),
    founderIds: cleanStringArray(value.founderIds),
  }
}

export function selectStatisticsEmailRecipients(
  rows: StatisticsEmailRecipientRow[],
  group: StatisticsEmailGroup,
  filters: StatisticsEmailRecipientFilters = {},
): StatisticsEmailRecipientRow[] {
  const matchesGroup = GROUP_MATCHERS[group] || GROUP_MATCHERS.all
  const founderIds = filters.founderIds?.length ? new Set(filters.founderIds) : null
  const seen = new Set<string>()
  const recipients: StatisticsEmailRecipientRow[] = []

  for (const row of rows) {
    if (!matchesGroup(row)) continue
    if (filters.trackId && row.programTrackId !== filters.trackId) continue
    if (filters.partnerId && row.partnerId !== filters.partnerId) continue
    if (filters.personality && row.personality !== filters.personality) continue
    if (founderIds && !founderIds.has(row.id)) continue
    if (filters.founderId && row.id !== filters.founderId) continue

    const email = normalizeEmail(row.email)
    if (!email || seen.has(email) || !email.includes('@')) continue

    seen.add(email)
    recipients.push({ ...row, email })
  }

  return recipients
}

function cleanNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(cleanNullableString).filter((item): item is string => Boolean(item))))
}

export function renderStatisticsEmailTemplate(
  template: StatisticsEmailTemplateContent,
  recipient: StatisticsEmailRecipientRow,
): RenderedStatisticsEmail {
  const subject = replaceVariables(template.subject, recipient)
  const body = replaceVariables(template.body, recipient)
  const html = escapeHtml(body).replace(/\r?\n/g, '<br />')

  return { subject, html }
}

export function normalizeStatisticsEmailAttachment(value: unknown): StatisticsEmailAttachment | null {
  if (!value || typeof value !== 'object') return null

  const raw = value as Record<string, unknown>
  const filename = cleanNullableString(raw.filename)
  const rawContent = cleanNullableString(raw.content)
  if (!filename || !rawContent) return null

  const content = rawContent.includes(',') && rawContent.startsWith('data:')
    ? rawContent.slice(rawContent.indexOf(',') + 1)
    : rawContent

  if (!content) return null

  const size = typeof raw.size === 'number' && Number.isFinite(raw.size)
    ? raw.size
    : Math.floor((content.length * 3) / 4)

  if (size > MAX_ATTACHMENT_BYTES) {
    throw new Error('Attachment is too large. Maximum size is 10 MB.')
  }

  const contentType = cleanNullableString(raw.contentType)
  return {
    filename: filename.replace(/[\\/\r\n]/g, '_'),
    content,
    ...(contentType ? { contentType } : {}),
  }
}

export function buildStatisticsEmailSendOptions(input: {
  to: string
  subject: string
  html: string
  attachments?: StatisticsEmailAttachment[] | null
}): StatisticsEmailSendOptions {
  return {
    to: input.to,
    subject: input.subject,
    html: input.html,
    ...(input.attachments && input.attachments.length > 0
      ? {
          attachments: input.attachments.map((attachment) => ({
            filename: attachment.filename,
            content: attachment.content,
            encoding: 'base64' as const,
            ...(attachment.contentType ? { contentType: attachment.contentType } : {}),
          })),
        }
      : {}),
  }
}

export function chunkStatisticsEmailSendOptions<T>(items: T[], batchSize: number): T[][] {
  const safeBatchSize = Math.max(1, Math.floor(batchSize))
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += safeBatchSize) {
    chunks.push(items.slice(index, index + safeBatchSize))
  }

  return chunks
}

function replaceVariables(value: string, recipient: StatisticsEmailRecipientRow): string {
  return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    const reader = VARIABLE_READERS[key]
    return reader ? reader(recipient) : match
  })
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
