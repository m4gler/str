import { describe, expect, it } from 'vitest'
import {
  buildStatisticsEmailSendOptions,
  chunkStatisticsEmailSendOptions,
  normalizeStatisticsEmailAttachment,
  renderStatisticsEmailTemplate,
  selectStatisticsEmailRecipients,
  toStatisticsEmailTemplateTarget,
  type StatisticsEmailRecipientRow,
} from '@/lib/statisticsEmail'

const rows: StatisticsEmailRecipientRow[] = [
  {
    id: '1',
    email: ' founder@example.com ',
    programTrackId: 'track-saas',
    programStatus: 'prework',
    attemptStatus: null,
    programTrackName: 'SaaS',
    partnerName: 'Campus',
    personality: 'Builder',
    steps: { prework: true, started100Days: false, active100Days: false, finished: false, failed: false },
  },
  {
    id: '2',
    email: 'active@example.com',
    programTrackId: 'track-ai',
    programStatus: 'active',
    attemptStatus: 'active',
    programTrackName: 'AI',
    partnerName: null,
    personality: null,
    steps: { prework: true, started100Days: true, active100Days: true, finished: false, failed: false },
  },
  {
    id: '3',
    email: 'finished@example.com',
    programTrackId: null,
    programStatus: 'completed',
    attemptStatus: 'completed',
    programTrackName: null,
    partnerName: null,
    personality: null,
    steps: { prework: true, started100Days: true, active100Days: false, finished: true, failed: false },
  },
  {
    id: '4',
    email: 'founder@example.com',
    programTrackId: 'track-saas',
    programStatus: 'failed',
    attemptStatus: 'failed',
    programTrackName: 'SaaS',
    partnerName: 'Campus',
    personality: 'Builder',
    steps: { prework: true, started100Days: true, active100Days: false, finished: false, failed: true },
  },
]

describe('statistics email helpers', () => {
  it('selects unique valid recipients from the current statistics rows', () => {
    expect(selectStatisticsEmailRecipients(rows, 'all').map((row) => row.email)).toEqual([
      'founder@example.com',
      'active@example.com',
      'finished@example.com',
    ])
  })

  it('selects recipients by statistics status groups', () => {
    expect(selectStatisticsEmailRecipients(rows, 'preprogram').map((row) => row.email)).toEqual(['founder@example.com'])
    expect(selectStatisticsEmailRecipients(rows, 'started').map((row) => row.email)).toEqual([
      'active@example.com',
      'finished@example.com',
    ])
    expect(selectStatisticsEmailRecipients(rows, 'finished').map((row) => row.email)).toEqual(['finished@example.com'])
    expect(selectStatisticsEmailRecipients(rows, 'failed').map((row) => row.email)).toEqual(['founder@example.com'])
  })

  it('filters recipients by track, personality, and founder id', () => {
    expect(selectStatisticsEmailRecipients(rows, 'all', { trackId: 'track-saas' }).map((row) => row.id)).toEqual(['1'])
    expect(selectStatisticsEmailRecipients(rows, 'all', { personality: 'Builder' }).map((row) => row.id)).toEqual(['1'])
    expect(selectStatisticsEmailRecipients(rows, 'all', { founderId: '2' }).map((row) => row.email)).toEqual(['active@example.com'])
    expect(selectStatisticsEmailRecipients(rows, 'all', { founderIds: ['2', '3'] }).map((row) => row.email)).toEqual(['active@example.com', 'finished@example.com'])
    expect(selectStatisticsEmailRecipients(rows, 'all', { trackId: 'track-ai', founderId: '1' })).toEqual([])
  })

  it('renders founder variables and escapes body text before converting line breaks', () => {
    const rendered = renderStatisticsEmailTemplate(
      {
        subject: 'Hello {{email}}',
        body: 'Track: {{track}}\nPartner: {{partner}}\n<script>alert(1)</script>',
      },
      rows[0],
    )

    expect(rendered.subject).toBe('Hello founder@example.com')
    expect(rendered.html).toContain('Track: SaaS<br />Partner: Campus')
    expect(rendered.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('normalizes saved template targeting fields', () => {
    expect(toStatisticsEmailTemplateTarget({
      group: 'finished',
      trackId: 'track-saas',
      personality: 'Builder',
      founderId: '1',
      founderIds: ['2', '3'],
    })).toEqual({
      group: 'finished',
      trackId: 'track-saas',
      personality: 'Builder',
      founderId: '1',
      founderIds: ['2', '3'],
    })

    expect(toStatisticsEmailTemplateTarget({
      group: 'not-real',
      trackId: ' ',
      personality: null,
      founderId: undefined,
      founderIds: [' ', 4, '5'],
    })).toEqual({
      group: 'all',
      trackId: null,
      personality: null,
      founderId: null,
      founderIds: ['5'],
    })
  })

  it('normalizes optional email attachments for statistics sends', () => {
    const attachment = normalizeStatisticsEmailAttachment({
      filename: ' Founder update.pdf ',
      content: 'data:application/pdf;base64,SGVsbG8=',
      contentType: 'application/pdf',
      size: 5,
    })

    expect(attachment).toEqual({
      filename: 'Founder update.pdf',
      content: 'SGVsbG8=',
      contentType: 'application/pdf',
    })

    expect(normalizeStatisticsEmailAttachment({
      filename: 'empty.pdf',
      content: '',
    })).toBeNull()
  })

  it('adds an attachment to statistics email send options when provided', () => {
    const sendOptions = buildStatisticsEmailSendOptions({
      to: 'founder@example.com',
      subject: 'Update',
      html: '<p>Hello</p>',
      attachments: [
        {
          filename: 'deck.pdf',
          content: 'SGVsbG8=',
          contentType: 'application/pdf',
        },
      ],
    })

    expect(sendOptions).toEqual({
      to: 'founder@example.com',
      subject: 'Update',
      html: '<p>Hello</p>',
      attachments: [
        {
          filename: 'deck.pdf',
          content: 'SGVsbG8=',
          encoding: 'base64',
          contentType: 'application/pdf',
        },
      ],
    })
  })

  it('chunks statistics email send options for throttled bulk delivery', () => {
    const messages = Array.from({ length: 7 }, (_, index) => ({
      to: `founder-${index + 1}@example.com`,
      subject: 'Update',
      html: '<p>Hello</p>',
    }))

    expect(chunkStatisticsEmailSendOptions(messages, 3).map((chunk) => chunk.map((message) => message.to))).toEqual([
      ['founder-1@example.com', 'founder-2@example.com', 'founder-3@example.com'],
      ['founder-4@example.com', 'founder-5@example.com', 'founder-6@example.com'],
      ['founder-7@example.com'],
    ])
  })
})
