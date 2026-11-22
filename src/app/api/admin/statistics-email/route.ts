import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { Resend } from 'resend'
import config from '@/payload.config'
import { buildFounderAnalytics } from '@/lib/adminFounderAnalytics'
import { getActivePersonalityTestFormId } from '@/lib/personalityTest'
import {
  buildStatisticsEmailSendOptions,
  chunkStatisticsEmailSendOptions,
  normalizeStatisticsEmailAttachment,
  renderStatisticsEmailTemplate,
  selectStatisticsEmailRecipients,
  toStatisticsEmailTemplateTarget,
  type StatisticsEmailSendOptions,
  type StatisticsEmailGroup,
  type StatisticsEmailAttachment,
} from '@/lib/statisticsEmail'

const VALID_GROUPS = new Set<StatisticsEmailGroup>(['all', 'preprogram', 'started', 'active', 'finished', 'failed'])
const RESEND_BATCH_EMAIL_SIZE = 100
const RESEND_BATCH_DELAY_MS = 250
const RESEND_ATTACHMENT_EMAIL_BATCH_SIZE = 3
const RESEND_ATTACHMENT_BATCH_DELAY_MS = 1100

interface StatisticsEmailRequestBody {
  templateId?: string | number | null
  templateName?: string | null
  subject?: string | null
  body?: string | null
  saveTemplate?: boolean
  sendEmail?: boolean
  attachments?: StatisticsEmailAttachment[] | null
  group?: StatisticsEmailGroup
  filters?: {
    trackId?: string
    partnerId?: string
    personality?: string
    founderId?: string
    founderIds?: string[]
  }
}

export async function POST(request: NextRequest) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })

  if (!user || (user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as StatisticsEmailRequestBody
  const subject = body.subject?.trim() || ''
  const emailBody = body.body?.trim() || ''
  const templateName = body.templateName?.trim() || ''
  const group = VALID_GROUPS.has(body.group || 'all') ? body.group || 'all' : 'all'
  let attachments: StatisticsEmailAttachment[] = []

  if (body.attachments && Array.isArray(body.attachments)) {
    try {
      attachments = body.attachments
        .map(normalizeStatisticsEmailAttachment)
        .filter((a): a is StatisticsEmailAttachment => a !== null)
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || 'Invalid attachment' }, { status: 400 })
    }
  }

  if (!subject) {
    return NextResponse.json({ error: 'Subject is required' }, { status: 400 })
  }

  if (!emailBody) {
    return NextResponse.json({ error: 'Body is required' }, { status: 400 })
  }

  let savedTemplate: any = null
  if (body.saveTemplate) {
    if (!templateName) {
      return NextResponse.json({ error: 'Template name is required to save a template' }, { status: 400 })
    }

    const target = toStatisticsEmailTemplateTarget({
      group,
      trackId: body.filters?.trackId,
      personality: body.filters?.personality,
      founderId: body.filters?.founderId,
      founderIds: body.filters?.founderIds,
    })
    const templateData = {
      name: templateName,
      subject,
      body: emailBody,
      group: target.group,
      trackId: target.trackId,
      personality: target.personality,
      founderId: target.founderId,
      founderIds: target.founderIds.map((founderId) => ({ founderId })),
    }

    if (body.templateId) {
      savedTemplate = await payload.update({
        collection: 'statistics-email-templates' as any,
        id: body.templateId,
        data: templateData,
        overrideAccess: true,
      })
    } else {
      savedTemplate = await payload.create({
        collection: 'statistics-email-templates' as any,
        data: templateData,
        overrideAccess: true,
      })
    }
  }

  if (!body.sendEmail) {
    return NextResponse.json({
      ok: true,
      recipientCount: 0,
      sentCount: 0,
      failedCount: 0,
      savedTemplate,
    })
  }

  const [
    settings,
    users,
    submissions,
    projectSubmissions,
    attempts,
    partners,
    tracks,
  ] = await Promise.all([
    payload.findGlobal({ slug: 'platform-settings' as any, depth: 0 }),
    payload.find({ collection: 'users', where: { role: { equals: 'founder' } }, limit: 1000, depth: 1 }),
    payload.find({ collection: 'founder-form-submissions', limit: 10000, depth: 1, sort: '-createdAt' }),
    payload.find({ collection: 'project-submissions', limit: 10000, depth: 2, sort: '-createdAt' }),
    payload.find({ collection: 'attempts', limit: 10000, depth: 1, sort: '-updatedAt' }),
    payload.find({ collection: 'partners', limit: 500, depth: 0, sort: 'name' }),
    payload.find({ collection: 'tracks', limit: 500, depth: 0, sort: 'name' }),
  ])

  const analytics = buildFounderAnalytics({
    users: users.docs || [],
    submissions: submissions.docs || [],
    projectSubmissions: projectSubmissions.docs || [],
    attempts: attempts.docs || [],
    partners: partners.docs || [],
    tracks: tracks.docs || [],
    settings,
    activePersonalityTestFormId: getActivePersonalityTestFormId(settings),
  })

  const recipients = selectStatisticsEmailRecipients(analytics.rows, group, {
    trackId: body.filters?.trackId || undefined,
    partnerId: body.filters?.partnerId || undefined,
    personality: body.filters?.personality || undefined,
    founderId: body.filters?.founderId || undefined,
    founderIds: body.filters?.founderIds || undefined,
  })

  if (recipients.length === 0) {
    return NextResponse.json({
      error: 'No recipients match the selected filters and group',
      savedTemplate,
      recipientCount: 0,
    }, { status: 400 })
  }

  const resendApiKey = process.env.RESEND_API_KEY?.trim()
  if (!resendApiKey) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
  }

  const resend = new Resend(resendApiKey)
  const companyName = (settings as any).companyName || 'MESGA'
  const from = `${companyName} <notifications@email.bakery.vc>`

  const messages = recipients.map((recipient) => {
    const rendered = renderStatisticsEmailTemplate({ subject, body: emailBody }, recipient)
    return buildStatisticsEmailSendOptions({
      to: recipient.email,
      subject: rendered.subject,
      html: wrapStatisticsEmail(rendered.html),
      attachments,
    })
  })

  const sendSummary = attachments.length > 0
    ? await sendStatisticsEmailsIndividually(resend, messages, from)
    : await sendStatisticsEmailsWithBatchApi(resend, messages, from)

  return NextResponse.json({
    ok: sendSummary.failedCount === 0,
    recipientCount: recipients.length,
    sentCount: sendSummary.sentCount,
    failedCount: sendSummary.failedCount,
    savedTemplate,
  })
}

function wrapStatisticsEmail(html: string): string {
  return `
    <div style="font-family: Arial, sans-serif; color: #18181b; line-height: 1.55; font-size: 15px;">
      ${html}
    </div>
  `
}

async function sendStatisticsEmailsWithBatchApi(
  resend: Resend,
  messages: StatisticsEmailSendOptions[],
  from: string,
): Promise<{ sentCount: number; failedCount: number }> {
  let sentCount = 0
  let failedCount = 0
  const chunks = chunkStatisticsEmailSendOptions(messages, RESEND_BATCH_EMAIL_SIZE)

  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index]
    const response = await resend.batch.send(
      chunk.map((message) => ({
        from,
        to: message.to,
        subject: message.subject,
        html: message.html,
      })),
      { batchValidation: 'strict' },
    )

    if (hasResendError(response)) {
      failedCount += chunk.length
    } else {
      sentCount += chunk.length
    }

    if (index < chunks.length - 1) {
      await sleep(RESEND_BATCH_DELAY_MS)
    }
  }

  return { sentCount, failedCount }
}

async function sendStatisticsEmailsIndividually(
  resend: Resend,
  messages: StatisticsEmailSendOptions[],
  from: string,
): Promise<{ sentCount: number; failedCount: number }> {
  let sentCount = 0
  let failedCount = 0
  const chunks = chunkStatisticsEmailSendOptions(messages, RESEND_ATTACHMENT_EMAIL_BATCH_SIZE)

  for (let index = 0; index < chunks.length; index++) {
    const results = await Promise.allSettled(
      chunks[index].map((message) => resend.emails.send({ from, ...message })),
    )

    for (const result of results) {
      if (result.status === 'rejected' || hasResendError(result.value)) {
        failedCount += 1
      } else {
        sentCount += 1
      }
    }

    if (index < chunks.length - 1) {
      await sleep(RESEND_ATTACHMENT_BATCH_DELAY_MS)
    }
  }

  return { sentCount, failedCount }
}

function hasResendError(response: unknown): boolean {
  return Boolean(response && typeof response === 'object' && 'error' in response && (response as { error?: unknown }).error)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
