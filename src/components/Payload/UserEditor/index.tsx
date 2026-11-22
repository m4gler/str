'use client'

import { DefaultEditView, useDocumentInfo } from '@payloadcms/ui'
import type { DocumentViewClientProps } from 'payload'
import React, { useEffect, useMemo, useState } from 'react'

type DocWithDocs<T> = {
  docs?: T[]
}

type UserDoc = {
  id?: number | string
  role?: string | null
  email?: string | null
  programStatus?: string | null
  programAttempts?: number | null
}

type SubmissionDoc = {
  id: number | string
  createdAt?: string | null
  updatedAt?: string | null
  programDay?: number | null
  form?: {
    id?: number | string
    title?: string | null
    slug?: string | null
  } | number | null
}

type AttemptDoc = {
  id: number | string
  attemptNumber?: number | null
  currentDay?: number | null
  status?: string | null
  updatedAt?: string | null
}

type QuickAction = {
  label: string
  href: string
  tone?: 'primary' | 'muted'
}

type QuickCardData = {
  title: string
  status: string
  meta?: string | null
  actions?: QuickAction[]
}

type QuickLinksState = {
  founderIntake?: QuickCardData
  personality?: QuickCardData
  investorIntake?: QuickCardData
  latestAttempt?: QuickCardData
}

const panelStyle: React.CSSProperties = {
  marginBottom: 20,
  border: '1px solid var(--theme-border-color)',
  borderRadius: 10,
  background: 'var(--theme-bg)',
  overflow: 'hidden',
}

const panelHeaderStyle: React.CSSProperties = {
  padding: '18px 20px 10px',
  borderBottom: '1px solid var(--theme-border-color)',
}

const panelBodyStyle: React.CSSProperties = {
  padding: 20,
  display: 'grid',
  gap: 14,
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
}

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--theme-border-color)',
  borderRadius: 8,
  padding: 16,
  background: 'var(--theme-elevation-50)',
}

const statusStyle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 700,
  color: 'var(--theme-text)',
  margin: '0 0 8px',
}

const metaStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--theme-elevation-700)',
  lineHeight: 1.5,
  minHeight: 40,
}

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 12,
}

const buttonStyle = (tone: 'primary' | 'muted' = 'primary'): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px 12px',
  borderRadius: 6,
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 600,
  color: tone === 'primary' ? '#fff' : 'var(--theme-text)',
  background: tone === 'primary' ? 'var(--theme-success-500)' : 'var(--theme-elevation-150)',
  border: tone === 'primary' ? '1px solid var(--theme-success-500)' : '1px solid var(--theme-border-color)',
})

const subtleTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--theme-elevation-600)',
  margin: 0,
}

const headingStyle: React.CSSProperties = {
  margin: '0 0 4px',
  fontSize: 20,
  fontWeight: 700,
  color: 'var(--theme-text)',
}

function extractRelationId(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && value && 'id' in value) {
    const id = (value as { id?: number | string | null }).id
    return id == null ? null : String(id)
  }
  return null
}

function formatTimestamp(value?: string | null): string | null {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function describeSubmission(submission: SubmissionDoc | null | undefined): string | null {
  if (!submission) return null

  const formTitle =
    typeof submission.form === 'object' && submission.form
      ? submission.form.title || submission.form.slug || 'Form'
      : 'Form'
  const submittedAt = formatTimestamp(submission.createdAt || submission.updatedAt)

  if (!submittedAt) return formTitle
  return `${formTitle} • ${submittedAt}`
}

function formatAttemptStatus(status?: string | null): string {
  switch (status) {
    case 'not_started':
      return 'Not Started'
    case 'prework':
      return 'Prework'
    case 'active':
      return 'Active'
    case 'warned_1':
      return 'Warned 1'
    case 'warned_2':
      return 'Warned 2'
    case 'test':
      return 'Test Mode'
    case 'test_mode':
      return 'Test Mode'
    case 'frozen':
      return 'Frozen'
    case 'completed':
      return 'Completed'
    case 'failed':
      return 'Failed'
    default:
      return status || 'No attempt yet'
  }
}

function buildAdminDocLink(collection: string, id: number | string): string {
  return `/admin/collections/${collection}/${id}`
}

function pickFounderSubmissions(
  docs: SubmissionDoc[],
  activeFounderFormId: string | null,
  activePersonalityFormId: string | null,
) {
  let activeIntake: SubmissionDoc | null = null
  let fallbackIntake: SubmissionDoc | null = null
  let personality: SubmissionDoc | null = null

  for (const submission of docs) {
    const formId = extractRelationId(submission.form)
    const formSlug =
      typeof submission.form === 'object' && submission.form ? submission.form.slug || '' : ''
    const isDaily = Boolean(submission.programDay) || formSlug.startsWith('daily-')
    const isPersonality = activePersonalityFormId
      ? formId === activePersonalityFormId
      : false

    if (isPersonality && !personality) {
      personality = submission
      continue
    }

    if (isDaily) continue

    if (activeFounderFormId && formId === activeFounderFormId && !activeIntake) {
      activeIntake = submission
      continue
    }

    if (!fallbackIntake) {
      fallbackIntake = submission
    }
  }

  return {
    founderIntake: activeIntake || fallbackIntake,
    personality,
  }
}

function UserQuickLinksPanel() {
  const { data, id, isEditing } = useDocumentInfo()
  const user = (data || {}) as UserDoc
  const userId = user.id ?? id
  const [state, setState] = useState<QuickLinksState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const role = useMemo(() => user.role || null, [user.role])

  useEffect(() => {
    if (!isEditing || !userId || !role) {
      setState(null)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const encodedUserId = encodeURIComponent(String(userId))
        const requests: Promise<Response>[] = [fetch('/api/globals/platform-settings?depth=0')]

        if (role === 'founder') {
          requests.push(
            fetch(`/api/founder-form-submissions?where[user][equals]=${encodedUserId}&limit=50&sort=-createdAt&depth=1`),
            fetch(`/api/attempts?where[user][equals]=${encodedUserId}&limit=1&sort=-createdAt&depth=0`),
          )
        } else if (role === 'investor') {
          requests.push(
            fetch(`/api/investor-form-submissions?where[user][equals]=${encodedUserId}&limit=1&sort=-createdAt&depth=1`),
          )
        }

        const responses = await Promise.all(requests)
        responses.forEach((response) => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }
        })

        const [settingsData, ...otherData] = await Promise.all(responses.map((response) => response.json()))
        const nextState: QuickLinksState = {}

        if (role === 'founder') {
          const founderSubs = (otherData[0] as DocWithDocs<SubmissionDoc>)?.docs || []
          const latestAttempt = (otherData[1] as DocWithDocs<AttemptDoc>)?.docs?.[0] || null
          const activeFounderFormId = extractRelationId(settingsData?.activeFounderForm)
          const activePersonalityFormId = extractRelationId(settingsData?.activePersonalityTestForm)
          const { founderIntake, personality } = pickFounderSubmissions(
            founderSubs,
            activeFounderFormId,
            activePersonalityFormId,
          )

          nextState.founderIntake = founderIntake
            ? {
                title: 'Founder Intake',
                status: 'Submitted',
                meta: describeSubmission(founderIntake),
                actions: [
                  {
                    label: 'Open submission',
                    href: buildAdminDocLink('founder-form-submissions', founderIntake.id),
                  },
                ],
              }
            : {
                title: 'Founder Intake',
                status: 'Missing',
                meta: activeFounderFormId
                  ? 'No founder intake submission found for this user.'
                  : 'No active founder intake form configured in platform settings.',
                actions: activeFounderFormId
                  ? [
                      {
                        label: 'Open form config',
                        href: buildAdminDocLink('founder-forms', activeFounderFormId),
                        tone: 'muted',
                      },
                    ]
                  : [],
              }

          nextState.personality = personality
            ? {
                title: 'Personality Test',
                status: 'Completed',
                meta: describeSubmission(personality),
                actions: [
                  {
                    label: 'Open results',
                    href: buildAdminDocLink('founder-form-submissions', personality.id),
                  },
                ],
              }
            : {
                title: 'Personality Test',
                status: 'Missing',
                meta: activePersonalityFormId
                  ? 'No personality test submission found for this user.'
                  : 'No active personality form configured in platform settings.',
                actions: activePersonalityFormId
                  ? [
                      {
                        label: 'Open form config',
                        href: buildAdminDocLink('founder-forms', activePersonalityFormId),
                        tone: 'muted',
                      },
                    ]
                  : [],
              }

          nextState.latestAttempt = latestAttempt
            ? {
                title: '100 Days',
                status: formatAttemptStatus(latestAttempt.status),
                meta: [
                  latestAttempt.attemptNumber ? `Attempt ${latestAttempt.attemptNumber}` : null,
                  latestAttempt.currentDay ? `Day ${latestAttempt.currentDay}` : null,
                  formatTimestamp(latestAttempt.updatedAt),
                ]
                  .filter(Boolean)
                  .join(' • '),
                actions: [
                  {
                    label: 'Open attempt',
                    href: buildAdminDocLink('attempts', latestAttempt.id),
                  },
                ],
              }
            : {
                title: '100 Days',
                status: formatAttemptStatus(user.programStatus || 'not_started'),
                meta: user.programAttempts
                  ? `${user.programAttempts} attempt(s) used`
                  : 'No program attempt created yet.',
              }
        }

        if (role === 'investor') {
          const latestInvestorSubmission =
            (otherData[0] as DocWithDocs<SubmissionDoc>)?.docs?.[0] || null

          nextState.investorIntake = latestInvestorSubmission
            ? {
                title: 'Investor Intake',
                status: 'Submitted',
                meta: describeSubmission(latestInvestorSubmission),
                actions: [
                  {
                    label: 'Open submission',
                    href: buildAdminDocLink('investor-form-submissions', latestInvestorSubmission.id),
                  },
                ],
              }
            : {
                title: 'Investor Intake',
                status: 'Missing',
                meta: 'No investor intake submission found for this user.',
              }
        }

        if (!cancelled) {
          setState(nextState)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load related documents.')
          setState(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [id, isEditing, role, user.programAttempts, user.programStatus, userId])

  if (!isEditing || !userId || !role || !['founder', 'investor'].includes(role)) {
    return null
  }

  const cards = [
    state?.founderIntake,
    state?.personality,
    state?.latestAttempt,
    state?.investorIntake,
  ].filter(Boolean) as QuickCardData[]

  return (
    <div style={panelStyle}>
      <div style={panelHeaderStyle}>
        <h2 style={headingStyle}>Quick Links</h2>
        <p style={subtleTextStyle}>
          Related submissions and program state for {user.email || `user #${userId}`}.
        </p>
      </div>

      {loading ? (
        <div style={{ padding: 20, fontSize: 14, color: 'var(--theme-elevation-700)' }}>
          Loading related forms and attempts…
        </div>
      ) : error ? (
        <div style={{ padding: 20, fontSize: 14, color: 'var(--theme-error-500)' }}>
          Failed to load quick links: {error}
        </div>
      ) : cards.length > 0 ? (
        <div style={panelBodyStyle}>
          {cards.map((card) => (
            <section key={card.title} style={cardStyle}>
              <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: 'var(--theme-elevation-600)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {card.title}
              </p>
              <p style={statusStyle}>{card.status}</p>
              <p style={metaStyle}>{card.meta || 'No extra details available.'}</p>

              {card.actions && card.actions.length > 0 && (
                <div style={actionsStyle}>
                  {card.actions.map((action) => (
                    <a key={action.href} href={action.href} style={buttonStyle(action.tone)}>
                      {action.label}
                    </a>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      ) : (
        <div style={{ padding: 20, fontSize: 14, color: 'var(--theme-elevation-700)' }}>
          No related shortcuts for this user role.
        </div>
      )}
    </div>
  )
}

export default function UserEditor(props: DocumentViewClientProps) {
  return (
    <>
      <UserQuickLinksPanel />
      <DefaultEditView {...props} />
    </>
  )
}
