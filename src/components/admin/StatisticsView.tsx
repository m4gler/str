'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getActivePersonalityTestFormId } from '@/lib/personalityTest'
import { buildFounderAnalytics, type FounderAnalyticsResult } from '@/lib/adminFounderAnalytics'
import { selectStatisticsEmailRecipients, toStatisticsEmailTemplateTarget, type StatisticsEmailAttachment, type StatisticsEmailGroup } from '@/lib/statisticsEmail'

const STEP_LABELS: Array<{ key: keyof NonNullable<FounderAnalyticsResult>['stepCounts']; label: string; hint: string }> = [
  { key: 'registered', label: 'Registration', hint: 'Founder accounts created' },
  { key: 'intake', label: 'Intake', hint: 'Founder intake submitted' },
  { key: 'personality', label: 'Personality', hint: 'Personality test completed' },
  { key: 'project', label: 'Project', hint: 'Project submitted for review' },
  { key: 'prework', label: 'Prework', hint: 'Paid or entered prework/program' },
  { key: 'started100Days', label: '100 Days', hint: 'Program attempt started' },
  { key: 'finished', label: 'Finished', hint: 'Completed 100 Day program' },
]

const FOUNDER_PANEL_STEPS: Array<{ key: keyof NonNullable<FounderAnalyticsResult>['stepCounts']; label: string }> = [
  { key: 'registered', label: 'Registration' },
  { key: 'intake', label: 'Intake' },
  { key: 'personality', label: 'Personality' },
  { key: 'project', label: 'Project' },
  { key: 'prework', label: 'Prework' },
  { key: 'started100Days', label: '100 Days' },
  { key: 'finished', label: 'Finished' },
  { key: 'failed', label: 'Failed' },
]

const selectStyle: React.CSSProperties = {
  width: '100%',
  height: 40,
  padding: '10px 12px',
  borderRadius: 6,
  border: '1px solid var(--theme-elevation-250)',
  background: 'var(--theme-elevation-0)',
  color: 'var(--theme-text)',
  fontSize: 13,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 6,
  border: '1px solid var(--theme-elevation-250)',
  background: 'var(--theme-elevation-0)',
  color: 'var(--theme-text)',
  fontSize: 13,
}

const payloadBackLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 11px',
  borderRadius: 6,
  border: '1px solid var(--theme-elevation-200)',
  background: 'var(--theme-elevation-0)',
  color: 'var(--theme-elevation-800)',
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 18,
}

const EMAIL_GROUP_OPTIONS: Array<{ id: StatisticsEmailGroup; label: string }> = [
  { id: 'all', label: 'All filtered founders' },
  { id: 'preprogram', label: 'Pre-program / prework' },
  { id: 'started', label: 'Started 100 Days' },
  { id: 'active', label: 'Active 100 Days' },
  { id: 'finished', label: 'Finished' },
  { id: 'failed', label: 'Failed / dropped' },
]

const MAX_EMAIL_ATTACHMENT_BYTES = 10 * 1024 * 1024

interface StatisticsEmailTemplate {
  id: string | number
  name: string
  subject: string
  body: string
  group?: StatisticsEmailGroup | null
  trackId?: string | null
  personality?: string | null
  founderId?: string | null
  founderIds?: Array<{ founderId?: string | null } | string> | null
}

export function StatisticsView() {
  const [analytics, setAnalytics] = useState<FounderAnalyticsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<StatisticsEmailTemplate[]>([])
  const [trackId, setTrackId] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [personality, setPersonality] = useState('')
  const [selectedFounderId, setSelectedFounderId] = useState<string | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [emailGroup, setEmailGroup] = useState<StatisticsEmailGroup>('all')
  const [emailTrackId, setEmailTrackId] = useState('')
  const [emailPersonality, setEmailPersonality] = useState('')
  const [emailFounderIds, setEmailFounderIds] = useState<string[]>([])
  const [emailAttachments, setEmailAttachments] = useState<StatisticsEmailAttachment[]>([])
  const [emailSending, setEmailSending] = useState(false)
  const [confirmingEmailSend, setConfirmingEmailSend] = useState(false)
  const [emailNotice, setEmailNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [settingsRes, usersRes, subsRes, projectsRes, attemptsRes, partnersRes, tracksRes, templatesRes] = await Promise.all([
        fetch('/api/globals/platform-settings?depth=0'),
        fetch('/api/users?where[role][equals]=founder&limit=1000&depth=1'),
        fetch('/api/founder-form-submissions?limit=10000&depth=1&sort=-createdAt'),
        fetch('/api/project-submissions?limit=10000&depth=2&sort=-createdAt'),
        fetch('/api/attempts?limit=10000&depth=1&sort=-updatedAt'),
        fetch('/api/partners?limit=500&depth=0&sort=name'),
        fetch('/api/tracks?limit=500&depth=0&sort=name'),
        fetch('/api/statistics-email-templates?limit=100&depth=0&sort=name'),
      ])

      for (const response of [settingsRes, usersRes, subsRes, projectsRes, attemptsRes, partnersRes, tracksRes, templatesRes]) {
        if (!response.ok) throw new Error(`Failed to fetch ${response.url}`)
      }

      const [settings, usersData, subsData, projectsData, attemptsData, partnersData, tracksData, templatesData] = await Promise.all([
        settingsRes.json(),
        usersRes.json(),
        subsRes.json(),
        projectsRes.json(),
        attemptsRes.json(),
        partnersRes.json(),
        tracksRes.json(),
        templatesRes.json(),
      ])

      setTemplates(templatesData.docs || [])

      setAnalytics(buildFounderAnalytics({
        users: usersData.docs || [],
        submissions: subsData.docs || [],
        projectSubmissions: projectsData.docs || [],
        attempts: attemptsData.docs || [],
        partners: partnersData.docs || [],
        tracks: tracksData.docs || [],
        settings,
        activePersonalityTestFormId: getActivePersonalityTestFormId(settings),
        filters: {
          trackId: trackId || undefined,
          partnerId: partnerId || undefined,
          personality: personality || undefined,
        },
      }))
    } catch (err: any) {
      setError(err?.message || 'Failed to load statistics')
    } finally {
      setLoading(false)
    }
  }, [partnerId, personality, trackId])

  useEffect(() => { fetchData() }, [fetchData])

  const filteredTotal = analytics?.filteredRows.length || 0
  const selectedFounder = analytics?.filteredRows.find((row) => row.id === selectedFounderId) || null
  const emailFounderOptions = useMemo(() => {
    if (!analytics) return []
    return analytics.rows
      .filter((row) => {
        if (emailTrackId && row.programTrackId !== emailTrackId) return false
        if (emailPersonality && row.personality !== emailPersonality) return false
        return true
      })
      .map((row) => ({ id: row.id, label: row.email }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [analytics, emailPersonality, emailTrackId])
  const selectedEmailFounderOptions = useMemo(() => {
    const selected = new Set(emailFounderIds)
    return emailFounderOptions.filter((option) => selected.has(option.id))
  }, [emailFounderIds, emailFounderOptions])
  const emailRecipients = useMemo(() => {
    if (!analytics) return []
    return selectStatisticsEmailRecipients(analytics.rows, emailGroup, {
      trackId: emailTrackId || undefined,
      personality: emailPersonality || undefined,
      founderIds: emailFounderIds,
    })
  }, [analytics, emailFounderIds, emailGroup, emailPersonality, emailTrackId])
  const emailRecipientCount = emailRecipients.length
  const maxStepCount = useMemo(() => {
    if (!analytics) return 1
    return Math.max(...STEP_LABELS.map((step) => analytics.stepCounts[step.key]), 1)
  }, [analytics])

  const payloadBackLink = (
    <Link href="/admin" aria-label="Back to Payload admin" style={payloadBackLinkStyle}>
      <span aria-hidden="true">←</span>
      <span>Back to Payload</span>
    </Link>
  )

  const handleTemplateChange = (value: string) => {
    setSelectedTemplateId(value)
    setEmailNotice(null)
    if (!value) {
      setTemplateName('')
      setEmailSubject('')
      setEmailBody('')
      setEmailGroup('all')
      setEmailTrackId('')
      setEmailPersonality('')
      setEmailFounderIds([])
      setEmailAttachments([])
      return
    }

    const template = templates.find((item) => String(item.id) === value)
    if (!template) return
    const target = toStatisticsEmailTemplateTarget(template)
    setTemplateName(template.name || '')
    setEmailSubject(template.subject || '')
    setEmailBody(template.body || '')
    setEmailGroup(target.group)
    setEmailTrackId(target.trackId || '')
    setEmailPersonality(target.personality || '')
    setEmailFounderIds(target.founderIds.length > 0 ? target.founderIds : target.founderId ? [target.founderId] : [])
  }

  const handleAttachmentChange = async (files: FileList | null) => {
    setEmailNotice(null)
    if (!files || files.length === 0) {
      return
    }

    const newAttachments: StatisticsEmailAttachment[] = []
    let hasError = false

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.size > MAX_EMAIL_ATTACHMENT_BYTES) {
        setEmailNotice({ tone: 'error', text: `Attachment ${file.name} is too large. Maximum size is 10 MB.` })
        hasError = true
        continue
      }

      try {
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result || ''))
          reader.onerror = () => reject(new Error('Failed to read attachment'))
          reader.readAsDataURL(file)
        })

        newAttachments.push({
          filename: file.name,
          content,
          contentType: file.type || null,
          size: file.size,
        })
      } catch (err) {
        setEmailNotice({ tone: 'error', text: `Failed to process ${file.name}` })
        hasError = true
      }
    }

    if (newAttachments.length > 0) {
      setEmailAttachments((current) => [...current, ...newAttachments])
    }
  }

  const submitEmail = async ({ saveTemplate, sendEmail }: { saveTemplate: boolean; sendEmail: boolean }) => {
    setEmailSending(true)
    setConfirmingEmailSend(false)
    setEmailNotice(null)
    try {
      const response = await fetch('/api/admin/statistics-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplateId || null,
          templateName,
          subject: emailSubject,
          body: emailBody,
          saveTemplate,
          sendEmail,
          attachment: null, // Removed in favor of attachments
          attachments: sendEmail ? emailAttachments : null,
          group: emailGroup,
          filters: {
            trackId: emailTrackId || undefined,
            personality: emailPersonality || undefined,
            founderIds: emailFounderIds,
          },
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result?.error || 'Email action failed')

      if (result.savedTemplate) {
        const saved = result.savedTemplate as StatisticsEmailTemplate
        setTemplates((current) => {
          const withoutSaved = current.filter((item) => String(item.id) !== String(saved.id))
          return [...withoutSaved, saved].sort((a, b) => a.name.localeCompare(b.name))
        })
        setSelectedTemplateId(String(saved.id))
      }

      if (sendEmail) {
        setEmailNotice({ tone: 'success', text: `Email sent. ${result.sentCount} of ${result.recipientCount} recipients received the message.` })
      } else {
        setEmailNotice({ tone: 'success', text: 'Template saved.' })
      }
    } catch (err: any) {
      setEmailNotice({ tone: 'error', text: err?.message || 'Email action failed' })
    } finally {
      setEmailSending(false)
    }
  }

  if (loading && !analytics) {
    return (
      <div style={{ minHeight: '100%', background: 'var(--theme-bg)', padding: 40, color: 'var(--theme-elevation-700)' }}>
        {payloadBackLink}
        <div>Loading statistics...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: '100%', background: 'var(--theme-bg)', padding: 40 }}>
        {payloadBackLink}
        <div style={{ color: '#b42318', fontWeight: 700, marginBottom: 12 }}>Error: {error}</div>
        <button onClick={fetchData} style={{ padding: '9px 14px', borderRadius: 6, border: '1px solid var(--theme-elevation-250)', cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    )
  }

  if (!analytics) return null

  return (
    <div style={{ minHeight: '100%', background: 'var(--theme-bg)' }}>
    <div style={{ padding: '24px 30px 40px', maxWidth: 1500, margin: '0 auto' }}>
      {payloadBackLink}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 30, lineHeight: 1.1, fontWeight: 800, margin: '0 0 6px', color: 'var(--theme-text)' }}>Statistics</h1>
          <p style={{ margin: 0, color: 'var(--theme-elevation-700)', fontSize: 14 }}>
            Funnel and cohort health across registration, intake, personality, project review, prework and the 100 Day program.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchData}
          style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid var(--theme-elevation-250)', background: 'var(--theme-elevation-0)', color: 'var(--theme-text)', cursor: 'pointer', fontWeight: 700 }}
        >
          Refresh
        </button>
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: 12, marginBottom: 22 }}>
        <FilterSelect label="Track" value={trackId} onChange={setTrackId} options={analytics.trackOptions} emptyLabel="All tracks" />
        <FilterSelect label="Personality" value={personality} onChange={setPersonality} options={analytics.personalityOptions} emptyLabel="All personalities" />
        <FilterSelect label="Partner" value={partnerId} onChange={setPartnerId} options={analytics.partnerOptions} emptyLabel="All partners" />
      </section>

      <section style={{ padding: 18, border: '1px solid var(--theme-elevation-150)', background: 'var(--theme-elevation-0)', borderRadius: 8, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 16, margin: '0 0 5px', fontWeight: 850, color: 'var(--theme-text)' }}>Email founders</h2>
            <p style={{ margin: 0, color: 'var(--theme-elevation-700)', fontSize: 12 }}>
              Email filters are applied before the selected group. Variables: {'{{email}}'}, {'{{track}}'}, {'{{partner}}'}, {'{{personality}}'}, {'{{status}}'}.
            </p>
          </div>
          <div style={{ minWidth: 130, textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 850, color: '#ffcc00', lineHeight: 1 }}>{emailRecipientCount}</div>
            <div style={{ fontSize: 10, color: 'var(--theme-elevation-700)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 800 }}>Recipients</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(170px, 0.9fr) minmax(170px, 0.9fr) minmax(220px, 1.2fr)', gap: 12, marginBottom: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 800, color: 'var(--theme-elevation-800)' }}>Template</span>
            <select value={selectedTemplateId} onChange={(event) => handleTemplateChange(event.target.value)} style={selectStyle}>
              <option value="">New template</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 800, color: 'var(--theme-elevation-800)' }}>Send to</span>
            <select value={emailGroup} onChange={(event) => setEmailGroup(event.target.value as StatisticsEmailGroup)} style={selectStyle}>
              {EMAIL_GROUP_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 800, color: 'var(--theme-elevation-800)' }}>Template name</span>
            <input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Program reminder" style={inputStyle} />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(170px, 1fr))', gap: 12, marginBottom: 12, alignItems: 'start' }}>
          <FilterSelect label="Email track" value={emailTrackId} onChange={(value) => { setEmailTrackId(value); setEmailFounderIds([]) }} options={analytics.trackOptions} emptyLabel="All tracks" />
          <FilterSelect label="Email personality" value={emailPersonality} onChange={(value) => { setEmailPersonality(value); setEmailFounderIds([]) }} options={analytics.personalityOptions} emptyLabel="All personalities" />
          <MultiSelectFilter
            label="Founders"
            values={emailFounderIds}
            onChange={setEmailFounderIds}
            options={emailFounderOptions}
            emptyLabel="All founders"
            noOptionsLabel="No founders match selected track/personality."
          />
        </div>
        {selectedEmailFounderOptions.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '-4px 0 12px' }}>
            {selectedEmailFounderOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setEmailFounderIds((current) => current.filter((id) => id !== option.id))}
                style={{ border: '1px solid var(--theme-elevation-200)', background: 'var(--theme-elevation-50)', color: 'var(--theme-text)', borderRadius: 999, padding: '5px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={`Remove ${option.label}`}
              >
                {option.label} x
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 800, color: 'var(--theme-elevation-800)' }}>Subject</span>
            <input value={emailSubject} onChange={(event) => setEmailSubject(event.target.value)} placeholder="Your MESGA update" style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 800, color: 'var(--theme-elevation-800)' }}>Message</span>
            <textarea value={emailBody} onChange={(event) => setEmailBody(event.target.value)} placeholder="Write the email body..." rows={6} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.45 }} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 800, color: 'var(--theme-elevation-800)' }}>Attachments</span>
            <input
              type="file"
              multiple
              onChange={(event) => {
                void handleAttachmentChange(event.target.files)
                // Clear the input value so the same files can be selected again if removed
                event.target.value = ''
              }}
              style={{ ...inputStyle, cursor: 'pointer' }}
            />
          </label>
        </div>
        {emailAttachments.length > 0 && (
          <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
            {emailAttachments.map((attachment, index) => (
              <div key={`${attachment.filename}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '9px 11px', borderRadius: 6, border: '1px solid var(--theme-elevation-150)', background: 'var(--theme-elevation-50)', fontSize: 12, color: 'var(--theme-elevation-800)' }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Attached: <strong style={{ color: 'var(--theme-text)' }}>{attachment.filename}</strong> ({Math.ceil((attachment.size || 0) / 1024)} KB)
                </span>
                <button
                  type="button"
                  onClick={() => setEmailAttachments((current) => current.filter((_, i) => i !== index))}
                  style={{ border: 0, background: 'transparent', color: '#b42318', fontWeight: 800, cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginTop: 14 }}>
          {emailNotice ? (
            <div style={{ color: emailNotice.tone === 'success' ? '#067647' : '#b42318', fontSize: 12, fontWeight: 700 }}>{emailNotice.text}</div>
          ) : (
            <div style={{ color: emailRecipientCount === 0 ? '#b42318' : 'var(--theme-elevation-700)', fontSize: 12 }}>
              {emailRecipientCount === 0 ? 'No founders match the selected email filters.' : 'Messages are sent to unique email addresses only.'}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => submitEmail({ saveTemplate: true, sendEmail: false })}
              disabled={emailSending}
              style={{ padding: '9px 13px', borderRadius: 6, border: '1px solid var(--theme-elevation-250)', background: 'var(--theme-elevation-0)', color: 'var(--theme-text)', cursor: emailSending ? 'not-allowed' : 'pointer', fontWeight: 800 }}
            >
              Save template
            </button>
            <button
              type="button"
              onClick={() => setConfirmingEmailSend(true)}
              disabled={emailSending || emailRecipientCount === 0}
              style={{ padding: '9px 13px', borderRadius: 6, border: '1px solid #ffcc00', background: '#ffcc00', color: '#fff', cursor: emailSending || emailRecipientCount === 0 ? 'not-allowed' : 'pointer', fontWeight: 850 }}
            >
              {emailSending ? 'Sending...' : 'Send email'}
            </button>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(170px, 1fr))', gap: 14, marginBottom: 24 }}>
        <MetricCard label="Filtered founders" value={filteredTotal} tone="#ffcc00" />
        <MetricCard label="Finished" value={analytics.stepCounts.finished} tone="#2CB1A1" />
        <MetricCard label="Active 100 Days" value={analytics.stepCounts.active100Days} tone="#C96A4A" />
        <MetricCard label="Failed / dropped" value={analytics.stepCounts.failed} tone="#b42318" />
      </section>

      <section style={{ padding: 20, border: '1px solid var(--theme-elevation-150)', background: 'var(--theme-elevation-0)', borderRadius: 8, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, margin: '0 0 16px', fontWeight: 800, color: 'var(--theme-text)' }}>Step Funnel</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(110px, 1fr))', gap: 10 }}>
          {STEP_LABELS.map((step, index) => {
            const count = analytics.stepCounts[step.key]
            const previous = index === 0 ? count : analytics.stepCounts[STEP_LABELS[index - 1].key]
            const conversion = previous > 0 ? Math.round((count / previous) * 100) : 0
            return (
              <div key={step.key} style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 8, padding: 12, background: 'var(--theme-elevation-50)', minHeight: 132 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--theme-elevation-800)', textTransform: 'uppercase', marginBottom: 8 }}>{step.label}</div>
                <div style={{ fontSize: 28, fontWeight: 850, lineHeight: 1, color: 'var(--theme-text)' }}>{count}</div>
                <div style={{ height: 7, borderRadius: 999, background: 'var(--theme-elevation-150)', overflow: 'hidden', margin: '12px 0 8px' }}>
                  <div style={{ width: `${Math.max(4, (count / maxStepCount) * 100)}%`, height: '100%', background: '#ffcc00' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--theme-elevation-800)' }}>{index === 0 ? '100%' : `${conversion}% from previous`}</div>
                <div style={{ fontSize: 10, color: 'var(--theme-elevation-700)', marginTop: 5 }}>{step.hint}</div>
              </div>
            )
          })}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <Distribution title="Tracks" data={analytics.distributions.tracks} />
        <Distribution title="Personalities" data={analytics.distributions.personalities} />
        <Distribution title="Partners" data={analytics.distributions.partners} />
        <Distribution title="Statuses" data={analytics.distributions.statuses} />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: selectedFounder ? 'minmax(0, 1fr) 430px' : '1fr', gap: 18, alignItems: 'start' }}>
        <div style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 8, overflow: 'hidden', background: 'var(--theme-elevation-0)' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--theme-elevation-150)', display: 'flex', justifyContent: 'space-between' }}>
            <strong style={{ color: 'var(--theme-text)' }}>Founder rows</strong>
            <span style={{ color: 'var(--theme-elevation-700)', fontSize: 12 }}>{filteredTotal} shown</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--theme-elevation-50)', color: 'var(--theme-elevation-800)', textAlign: 'left' }}>
                  <Th>Email</Th>
                  <Th>Track</Th>
                  <Th>Personality</Th>
                  <Th>Partner</Th>
                  <Th>Status</Th>
                  <Th>Progress</Th>
                  <Th>Steps</Th>
                </tr>
              </thead>
              <tbody>
                {analytics.filteredRows.slice(0, 250).map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedFounderId(row.id)}
                    style={{
                      borderTop: '1px solid var(--theme-elevation-100)',
                      cursor: 'pointer',
                      background: selectedFounderId === row.id ? 'rgba(255,204,0, 0.06)' : 'transparent',
                    }}
                  >
                    <Td strong>
                      <span style={{ color: selectedFounderId === row.id ? '#ffcc00' : 'var(--theme-text)' }}>{row.email}</span>
                    </Td>
                    <Td>{row.programTrackName || 'Unassigned'}</Td>
                    <Td>{row.personality ? `${row.personalityEmoji || ''} ${row.personality}`.trim() : 'Missing'}</Td>
                    <Td>{row.partnerName || 'Unassigned'}</Td>
                    <Td>{row.attemptStatus || row.programStatus}</Td>
                    <Td>{row.completedDays.length}/100</Td>
                    <Td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {STEP_LABELS.map((step) => (
                          <span key={step.key} title={step.label} style={{ width: 9, height: 9, borderRadius: 999, background: row.steps[step.key] ? '#2CB1A1' : 'var(--theme-elevation-200)' }} />
                        ))}
                      </div>
                    </Td>
                  </tr>
                ))}
                {analytics.filteredRows.length === 0 && (
                  <tr><Td colSpan={7}>No founders match these filters.</Td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selectedFounder && (
          <FounderProfilePanel founder={selectedFounder} onClose={() => setSelectedFounderId(null)} />
        )}
      </section>
    </div>
    {confirmingEmailSend && (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="statistics-email-confirm-title"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          background: 'rgba(15, 23, 42, 0.45)',
        }}
      >
        <div style={{ width: 'min(680px, 100%)', maxHeight: 'min(720px, calc(100vh - 40px))', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', borderRadius: 8, border: '1px solid var(--theme-elevation-200)', background: 'var(--theme-elevation-0)', boxShadow: '0 24px 80px rgba(15, 23, 42, 0.22)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--theme-elevation-150)' }}>
            <h2 id="statistics-email-confirm-title" style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 850, color: 'var(--theme-text)' }}>Are you sure?</h2>
            <p style={{ margin: 0, color: 'var(--theme-elevation-700)', fontSize: 13, lineHeight: 1.45 }}>
              This will send one email to each of the {emailRecipientCount} selected recipients.
            </p>
          </div>
          <div style={{ padding: 20, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
              <strong style={{ color: 'var(--theme-text)', fontSize: 13 }}>Recipient list</strong>
              <span style={{ color: 'var(--theme-elevation-700)', fontSize: 12 }}>{emailRecipientCount} people</span>
            </div>
            <div style={{ display: 'grid', maxHeight: 360, overflowY: 'auto', border: '1px solid var(--theme-elevation-150)', borderRadius: 6 }}>
              {emailRecipients.map((recipient) => (
                <div key={`${recipient.id}-${recipient.email}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10, padding: '9px 11px', borderTop: '1px solid var(--theme-elevation-100)', color: 'var(--theme-text)', fontSize: 12 }}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recipient.email}</span>
                  <span style={{ color: 'var(--theme-elevation-700)', whiteSpace: 'nowrap' }}>{recipient.programTrackName || 'No track'}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 16, borderTop: '1px solid var(--theme-elevation-150)', background: 'var(--theme-elevation-50)' }}>
            <button
              type="button"
              onClick={() => setConfirmingEmailSend(false)}
              disabled={emailSending}
              style={{ padding: '9px 13px', borderRadius: 6, border: '1px solid var(--theme-elevation-250)', background: 'var(--theme-elevation-0)', color: 'var(--theme-text)', cursor: emailSending ? 'not-allowed' : 'pointer', fontWeight: 800 }}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => submitEmail({ saveTemplate: false, sendEmail: true })}
              disabled={emailSending || emailRecipientCount === 0}
              style={{ padding: '9px 13px', borderRadius: 6, border: '1px solid #b42318', background: '#b42318', color: '#fff', cursor: emailSending || emailRecipientCount === 0 ? 'not-allowed' : 'pointer', fontWeight: 850 }}
            >
              {emailSending ? 'Sending...' : 'Send now'}
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  )
}

function FilterSelect({ label, value, onChange, options, emptyLabel }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ id: string; label: string }>; emptyLabel: string }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 800, color: 'var(--theme-elevation-800)' }}>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} style={selectStyle}>
        <option value="">{emptyLabel}</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </label>
  )
}

function MultiSelectFilter({ label, values, onChange, options, emptyLabel, noOptionsLabel }: { label: string; values: string[]; onChange: (values: string[]) => void; options: Array<{ id: string; label: string }>; emptyLabel: string; noOptionsLabel: string }) {
  const [query, setQuery] = useState('')
  const selected = new Set(values)
  const normalizedQuery = query.trim().toLowerCase()
  const visibleOptions = normalizedQuery
    ? options.filter((option) => option.label.toLowerCase().includes(normalizedQuery))
    : options

  const toggleValue = (id: string) => {
    if (selected.has(id)) {
      onChange(values.filter((value) => value !== id))
      return
    }
    onChange([...values, id])
  }

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 800, color: 'var(--theme-elevation-800)' }}>{label}</span>
      <div style={{ border: '1px solid var(--theme-elevation-250)', borderRadius: 6, background: 'var(--theme-elevation-0)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderBottom: '1px solid var(--theme-elevation-150)' }}>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={options.length === 0 ? noOptionsLabel : values.length > 0 ? `${values.length} selected` : emptyLabel}
            disabled={options.length === 0}
            style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', color: 'var(--theme-text)', fontSize: 13 }}
          />
          {values.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              style={{ border: 0, background: 'transparent', color: 'var(--theme-elevation-700)', cursor: 'pointer', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}
            >
              Clear
            </button>
          )}
        </div>
        <div style={{ maxHeight: 150, overflowY: 'auto', display: 'grid' }}>
          {visibleOptions.map((option) => {
            const checked = selected.has(option.id)
            return (
              <label
                key={option.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer', color: 'var(--theme-text)', fontSize: 12, borderTop: '1px solid var(--theme-elevation-100)', background: checked ? 'rgba(255,204,0, 0.07)' : 'transparent' }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleValue(option.id)}
                  style={{ margin: 0 }}
                />
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{option.label}</span>
              </label>
            )
          })}
          {visibleOptions.length === 0 && (
            <div style={{ padding: 10, color: options.length === 0 ? '#b42318' : 'var(--theme-elevation-700)', fontSize: 12 }}>{options.length === 0 ? noOptionsLabel : 'No founders match search.'}</div>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 8, padding: 16, background: 'var(--theme-elevation-0)' }}>
      <div style={{ fontSize: 30, fontWeight: 850, color: tone, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--theme-elevation-800)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 800, marginTop: 7 }}>{label}</div>
    </div>
  )
}

function Distribution({ title, data }: { title: string; data: Record<string, number> }) {
  const rows = Object.entries(data).sort(([, a], [, b]) => b - a).slice(0, 8)
  const max = Math.max(...rows.map(([, count]) => count), 1)
  return (
    <div style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 8, padding: 16, background: 'var(--theme-elevation-0)' }}>
      <h3 style={{ fontSize: 13, margin: '0 0 12px', fontWeight: 800, color: 'var(--theme-text)' }}>{title}</h3>
      <div style={{ display: 'grid', gap: 9 }}>
        {rows.map(([label, count]) => (
          <div key={label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, marginBottom: 4, color: 'var(--theme-elevation-800)' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--theme-elevation-800)' }}>{label}</span>
              <strong style={{ color: 'var(--theme-elevation-800)', fontWeight: 800 }}>{count}</strong>
            </div>
            <div style={{ height: 5, background: 'var(--theme-elevation-200)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${(count / max) * 100}%`, height: '100%', background: '#2CB1A1' }} />
            </div>
          </div>
        ))}
        {rows.length === 0 && <div style={{ color: 'var(--theme-elevation-700)', fontSize: 12 }}>No data</div>}
      </div>
    </div>
  )
}

function FounderProfilePanel({ founder, onClose }: { founder: NonNullable<FounderAnalyticsResult['filteredRows'][number]>; onClose: () => void }) {
  const profileHref = `/admin/collections/users/${founder.id}`

  return (
    <aside style={{ position: 'sticky', top: 20, border: '1px solid var(--theme-elevation-150)', borderRadius: 8, padding: 18, background: 'var(--theme-elevation-0)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 16, fontWeight: 850, margin: '0 0 5px', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--theme-text)' }}>{founder.email}</h2>
          <div style={{ color: 'var(--theme-elevation-700)', fontSize: 12 }}>
            {founder.programTrackName || 'No track'} · {founder.personality ? `${founder.personalityEmoji || ''} ${founder.personality}`.trim() : 'No personality'}
          </div>
        </div>
        <button type="button" onClick={onClose} style={{ border: 0, background: 'transparent', color: 'var(--theme-elevation-700)', cursor: 'pointer', fontSize: 18 }}>x</button>
      </div>

      <a
        href={profileHref}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--theme-elevation-250)', textDecoration: 'none', color: 'var(--theme-text)', fontWeight: 800, fontSize: 13, marginBottom: 14 }}
      >
        Open Payload user profile
      </a>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
        <SmallStat label="Completed" value={`${founder.completedDays.length}/100`} />
        <SmallStat label="Day" value={founder.currentDay} />
        <SmallStat label="Status" value={founder.attemptStatus || founder.programStatus} />
      </div>

      <div style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--theme-elevation-700)', marginBottom: 14 }}>
        <div>Partner: <strong style={{ color: 'var(--theme-text)' }}>{founder.partnerName || 'Unassigned'}</strong></div>
        <div>Project: <strong style={{ color: 'var(--theme-text)' }}>{founder.latestProjectStatus || 'None'}</strong></div>
        <div>Last activity: <strong style={{ color: 'var(--theme-text)' }}>{founder.lastSubmissionAt ? new Date(founder.lastSubmissionAt).toLocaleString('en-US') : 'None'}</strong></div>
      </div>

      <h3 style={{ fontSize: 11, margin: '0 0 9px', color: 'var(--theme-elevation-800)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 850 }}>Steps</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, marginBottom: 16 }}>
        {FOUNDER_PANEL_STEPS.map((step) => {
          const completed = Boolean(founder.steps[step.key])
          const href = founder.stepLinks[step.key]
          const commonStyle: React.CSSProperties = {
            minHeight: 34,
            borderRadius: 7,
            border: `1px solid ${completed ? 'rgba(44, 177, 161, 0.35)' : 'var(--theme-elevation-150)'}`,
            background: completed ? 'rgba(44, 177, 161, 0.08)' : 'var(--theme-elevation-50)',
            color: completed ? 'var(--theme-text)' : 'var(--theme-elevation-600)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '7px 9px',
            fontSize: 11,
            fontWeight: 800,
            textDecoration: 'none',
          }

          const content = (
            <>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{step.label}</span>
              <span aria-hidden="true" style={{ color: completed ? '#2CB1A1' : 'var(--theme-elevation-400)' }}>{completed ? 'open' : 'missing'}</span>
            </>
          )

          if (completed && href) {
            return (
              <a key={step.key} href={href} title={`Open ${step.label}`} style={{ ...commonStyle, cursor: 'pointer' }}>
                {content}
              </a>
            )
          }

          return (
            <span key={step.key} title={`${step.label} not available`} style={{ ...commonStyle, cursor: 'default' }}>
              {content}
            </span>
          )
        })}
      </div>

      <h3 style={{ fontSize: 11, margin: '0 0 9px', color: 'var(--theme-elevation-800)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 850 }}>Calendar</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 3 }}>
        {Array.from({ length: 100 }, (_, index) => {
          const day = index + 1
          const completed = founder.completedDays.includes(day)
          const current = day === founder.currentDay
          const color = day <= 21 ? '#2CB1A1' : day <= 49 ? '#E0C188' : day <= 77 ? '#C96A4A' : '#ffcc00'
          const submissionId = founder.daySubmissionIds[day]
          const dayStyle: React.CSSProperties = {
            aspectRatio: '1',
            borderRadius: 4,
            border: current ? `2px solid ${color}` : '1px solid transparent',
            background: completed ? color : current ? `${color}22` : 'var(--theme-elevation-100)',
            color: completed ? '#fff' : 'var(--theme-elevation-700)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 8,
            fontWeight: 850,
            textDecoration: 'none',
            cursor: submissionId ? 'pointer' : 'default',
          }

          if (submissionId) {
            return (
              <a
                key={day}
                href={`/admin/collections/founder-form-submissions/${submissionId}`}
                title={`Open Day ${day} submission`}
                style={dayStyle}
              >
                {day}
              </a>
            )
          }

          return (
            <span
              key={day}
              title={`Day ${day}${completed ? ' completed' : current ? ' current' : ''}`}
              style={dayStyle}
            >
              {day}
            </span>
          )
        })}
      </div>
    </aside>
  )
}

function SmallStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ padding: '9px 7px', borderRadius: 7, background: 'var(--theme-elevation-50)', border: '1px solid var(--theme-elevation-150)', textAlign: 'center', minWidth: 0 }}>
      <div style={{ fontSize: 15, fontWeight: 850, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--theme-text)' }}>{value}</div>
      <div style={{ fontSize: 9, color: 'var(--theme-elevation-700)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 800 }}>{label}</div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 800 }}>{children}</th>
}

function Td({ children, strong, colSpan }: { children: React.ReactNode; strong?: boolean; colSpan?: number }) {
  return <td colSpan={colSpan} style={{ padding: '11px 12px', fontWeight: strong ? 700 : 400, color: 'var(--theme-text)' }}>{children}</td>
}

export default StatisticsView
