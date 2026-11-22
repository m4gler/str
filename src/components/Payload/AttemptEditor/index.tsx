'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ── Types ──

type AttemptDoc = {
  id: number | string
  user: { id: number; email: string; firstName?: string; lastName?: string; programStatus?: string; programAttempts?: number } | number
  cohort: { id: number; name: string; timezone: string } | number | null
  attemptNumber: number
  status: string
  missCount: number
  currentDay: number | null
  missedDays: number[]
  startedAt: string
  endedAt: string | null
  preworkCompletedAt: string | null
  paymentType: string
  partnerOverrideRequestedAt: string | null
  partnerDecision: string | null
  gateFailedAt: string | null
  gateRevisionDeadline: string | null
  gateRevisionForDay: number | null
  partnerReminderSentAt: string | null
  createdAt: string
  updatedAt: string
}

type Submission = {
  id: number | string
  programDay: number
  dayType: string
  isBackfill: boolean
  createdAt: string
  form: { title?: string; slug?: string } | number | null
}

type MentorReview = {
  id: number | string
  dayNumber: number
  score: number
  comment: string
  isGateReview: boolean
  gateDecision: string | null
  createdAt: string
}

// ── Constants ──

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: '#10b981' },
  { value: 'warned_1', label: 'Warned — Miss 1', color: '#f59e0b' },
  { value: 'warned_2', label: 'Warned — Miss 2 (LAST)', color: '#ef4444' },
  { value: 'completed', label: 'Completed', color: '#3b82f6' },
  { value: 'failed', label: 'Failed', color: '#ef4444' },
]

const PAYMENT_OPTIONS = [
  { value: 'self_paid', label: 'Self-Paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'free', label: 'Free' },
  { value: 'test', label: 'Test' },
  { value: 'sponsored', label: 'Sponsored' },
  { value: 'partnership', label: 'Partnership' },
]

const PARTNER_DECISION_OPTIONS = [
  { value: '', label: '— Not set —' },
  { value: 'pending', label: 'Pending' },
  { value: 'granted', label: 'Granted Extra Attempt' },
  { value: 'ended', label: 'Process Ended' },
]

const GATE_DAYS = [15, 30, 50, 70, 94]

// ── Styles ──

const inputStyle: React.CSSProperties = {
  padding: '7px 10px',
  background: 'var(--theme-input-bg)',
  border: '1px solid var(--theme-border-color)',
  borderRadius: 4,
  fontSize: 13,
  color: 'var(--theme-text)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--theme-elevation-600)',
  marginBottom: 4,
  display: 'block',
}

const sectionStyle: React.CSSProperties = {
  border: '1px solid var(--theme-border-color)',
  borderRadius: 8,
  padding: 20,
  marginBottom: 16,
  background: 'var(--theme-bg)',
}

const btnStyle = (color: string, outlined = false): React.CSSProperties => ({
  padding: '8px 20px',
  background: outlined ? 'transparent' : color,
  color: outlined ? color : '#fff',
  border: outlined ? `1px solid ${color}` : 'none',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
})

// ── Helpers ──

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function toDateInputValue(d: string | null | undefined): string {
  if (!d) return ''
  try {
    return new Date(d).toISOString().slice(0, 16)
  } catch {
    return ''
  }
}

function getUserInfo(a: AttemptDoc) {
  if (typeof a.user === 'object' && a.user) {
    const u = a.user
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ')
    return { email: u.email, name: name || u.email, id: u.id }
  }
  return { email: `User #${a.user}`, name: `User #${a.user}`, id: a.user }
}

// ── Timeline Grid ──

function AttemptTimeline({
  currentDay,
  missedDays,
  completedDays,
}: {
  currentDay: number
  missedDays: number[]
  completedDays: number[]
}) {
  const totalDays = 100
  const completedSet = new Set(completedDays)
  const missedSet = new Set(missedDays)
  const weeks = Math.ceil(totalDays / 7)

  function getStatus(day: number) {
    if (completedSet.has(day)) return 'completed'
    if (missedSet.has(day)) return 'missed'
    if (day === currentDay) return 'current'
    if (day < currentDay) return 'past'
    return 'future'
  }

  const rows: number[][] = []
  for (let w = 0; w < weeks; w++) {
    const row: number[] = []
    for (let d = 1; d <= 7; d++) {
      const num = w * 7 + d
      if (num <= totalDays) row.push(num)
    }
    rows.push(row)
  }

  const colors: Record<string, { bg: string; border: string; text: string }> = {
    completed: { bg: '#10b98125', border: '#10b98160', text: '#10b981' },
    missed: { bg: '#ef444425', border: '#ef444460', text: '#ef4444' },
    current: { bg: '#f59e0b25', border: '#f59e0b', text: '#f59e0b' },
    past: { bg: '#6b728015', border: '#6b728030', text: '#6b7280' },
    future: { bg: 'transparent', border: 'var(--theme-border-color)', text: 'var(--theme-elevation-400)' },
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, fontSize: 11, color: 'var(--theme-elevation-500)' }}>
        {[
          { label: 'Completed', color: '#10b981' },
          { label: 'Missed', color: '#ef4444' },
          { label: 'Current', color: '#f59e0b' },
          { label: 'Past (not submitted)', color: '#6b7280' },
        ].map(l => (
          <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color + '40', border: `1px solid ${l.color}80` }} />
            {l.label}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {rows.map((row, wi) => (
          <div key={wi} style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <span style={{ width: 24, fontSize: 10, color: 'var(--theme-elevation-400)', fontWeight: 600, textAlign: 'right', marginRight: 4 }}>
              W{wi + 1}
            </span>
            {row.map(day => {
              const s = getStatus(day)
              const c = colors[s]
              const isGate = GATE_DAYS.includes(day)
              const isRetro = day % 7 === 0 && !isGate
              return (
                <div
                  key={day}
                  title={`Day ${day} — ${s}${isGate ? ' (Gate)' : isRetro ? ' (Retro)' : ''}`}
                  style={{
                    width: isGate ? 30 : 26,
                    height: isGate ? 30 : 26,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: isGate ? 2 : 4,
                    transform: isGate ? 'rotate(45deg)' : undefined,
                    border: `${s === 'current' ? '2px' : '1px'} solid ${c.border}`,
                    background: c.bg,
                    fontSize: 9,
                    fontWeight: s === 'current' ? 700 : 500,
                    color: c.text,
                    cursor: 'default',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ transform: isGate ? 'rotate(-45deg)' : undefined }}>
                    {isRetro ? 'R' : day}
                  </span>
                </div>
              )
            })}
            {row.length < 7 && Array.from({ length: 7 - row.length }).map((_, i) => (
              <div key={`e${i}`} style={{ width: 26, height: 26, flexShrink: 0 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Editor ──

function getAttemptIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  // URL: /admin/collections/attempts/{id}
  const parts = window.location.pathname.split('/')
  const attIdx = parts.indexOf('attempts')
  if (attIdx >= 0 && parts[attIdx + 1]) {
    return parts[attIdx + 1]
  }
  return null
}

export default function AttemptEditor() {
  const router = useRouter()
  const [attempt, setAttempt] = useState<AttemptDoc | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [reviews, setReviews] = useState<MentorReview[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  // Editable fields
  const [status, setStatus] = useState('')
  const [missCount, setMissCount] = useState(0)
  const [currentDay, setCurrentDay] = useState(1)
  const [missedDays, setMissedDays] = useState<number[]>([])
  const [paymentType, setPaymentType] = useState('self_paid')
  const [startedAt, setStartedAt] = useState('')
  const [endedAt, setEndedAt] = useState('')
  const [preworkCompletedAt, setPreworkCompletedAt] = useState('')
  const [partnerDecision, setPartnerDecision] = useState('')
  const [gateRevisionDeadline, setGateRevisionDeadline] = useState('')
  const [gateRevisionForDay, setGateRevisionForDay] = useState<number | null>(null)

  const attemptId = getAttemptIdFromUrl()

  const fetchData = useCallback(async () => {
    if (!attemptId) return
    try {
      setLoading(true)
      setError(null)

      const attRes = await fetch(`/api/attempts/${attemptId}?depth=1`)
      if (!attRes.ok) throw new Error('Failed to load attempt')
      const att: AttemptDoc = await attRes.json()
      setAttempt(att)

      // Set editable fields
      setStatus(att.status)
      setMissCount(att.missCount)
      setCurrentDay(att.currentDay ?? 1)
      setMissedDays(att.missedDays || [])
      setPaymentType(att.paymentType)
      setStartedAt(toDateInputValue(att.startedAt))
      setEndedAt(toDateInputValue(att.endedAt))
      setPreworkCompletedAt(toDateInputValue(att.preworkCompletedAt))
      setPartnerDecision(att.partnerDecision || '')
      setGateRevisionDeadline(toDateInputValue(att.gateRevisionDeadline))
      setGateRevisionForDay(att.gateRevisionForDay ?? null)

      // Fetch submissions for this user
      const userId = typeof att.user === 'object' ? att.user.id : att.user
      const subsRes2 = await fetch(`/api/founder-form-submissions?where[user][equals]=${userId}&limit=200&sort=programDay&depth=1`)
      if (subsRes2.ok) {
        const subsData = await subsRes2.json()
        setSubmissions((subsData.docs || []).filter((s: any) => s.programDay > 0))
      }

      // Fetch mentor reviews
      try {
        const revRes = await fetch(`/api/mentor-reviews?where[submission.user][equals]=${userId}&limit=100&sort=-createdAt&depth=0`)
        if (revRes.ok) {
          const revData = await revRes.json()
          setReviews(revData.docs || [])
        }
      } catch {}

      setDirty(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [attemptId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSave = async () => {
    if (!attemptId) return
    try {
      setSaving(true)
      setSaveMsg(null)
      setError(null)

      const body: Record<string, any> = {
        status,
        missCount,
        currentDay,
        missedDays,
        paymentType,
        startedAt: startedAt ? new Date(startedAt).toISOString() : null,
        endedAt: endedAt ? new Date(endedAt).toISOString() : null,
        preworkCompletedAt: preworkCompletedAt ? new Date(preworkCompletedAt).toISOString() : null,
        partnerDecision: partnerDecision || null,
        gateRevisionDeadline: gateRevisionDeadline ? new Date(gateRevisionDeadline).toISOString() : null,
        gateRevisionForDay: gateRevisionForDay,
      }

      const res = await fetch(`/api/attempts/${attemptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.errors?.[0]?.message || 'Save failed')
      }

      setSaveMsg('Saved successfully')
      setDirty(false)
      setTimeout(() => setSaveMsg(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const markDirty = () => { setDirty(true); setSaveMsg(null) }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--theme-elevation-500)' }}>
        Loading attempt...
      </div>
    )
  }

  if (!attempt) {
    return (
      <div style={{ padding: 40, color: '#ef4444' }}>
        Attempt not found.{' '}
        <button onClick={() => router.back()} style={btnStyle('#6b7280', true)}>Go Back</button>
      </div>
    )
  }

  const userInfo = getUserInfo(attempt)
  const completedDays = submissions.map(s => s.programDay).filter(d => d > 0)
  const statusColor = STATUS_OPTIONS.find(s => s.value === status)?.color || '#6b7280'

  return (
    <div style={{ padding: '20px 40px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--theme-text)', margin: 0 }}>
              Attempt #{attempt.attemptNumber}
            </h1>
            <span
              style={{
                padding: '4px 14px',
                borderRadius: 16,
                fontSize: 12,
                fontWeight: 700,
                background: statusColor + '20',
                color: statusColor,
                border: `1px solid ${statusColor}40`,
              }}
            >
              {STATUS_OPTIONS.find(s => s.value === status)?.label || status}
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--theme-elevation-500)' }}>
            <a
              href={`/admin/collections/users/${userInfo.id}`}
              style={{ color: '#3b82f6', textDecoration: 'none' }}
            >
              {userInfo.name}
            </a>
            {userInfo.name !== userInfo.email && (
              <span style={{ marginLeft: 6, color: 'var(--theme-elevation-400)' }}>({userInfo.email})</span>
            )}
            <span style={{ margin: '0 8px', color: 'var(--theme-elevation-300)' }}>·</span>
            <span>{PAYMENT_OPTIONS.find(p => p.value === paymentType)?.label || paymentType}</span>
            <span style={{ margin: '0 8px', color: 'var(--theme-elevation-300)' }}>·</span>
            <span>Started {fmtDate(attempt.startedAt)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saveMsg && (
            <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>{saveMsg}</span>
          )}
          {error && (
            <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>{error}</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            style={{
              ...btnStyle('#3b82f6'),
              opacity: saving || !dirty ? 0.5 : 1,
              cursor: saving || !dirty ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Current Day', value: `${currentDay}/100`, color: statusColor },
          { label: 'Misses', value: `${missCount}/3`, color: missCount >= 3 ? '#ef4444' : missCount >= 2 ? '#f59e0b' : '#10b981' },
          { label: 'Completed', value: `${completedDays.length}`, color: '#3b82f6' },
          { label: 'Submissions', value: `${submissions.length}`, color: 'var(--theme-text)' },
          { label: 'Reviews', value: `${reviews.length}`, color: '#8b5cf6' },
        ].map(s => (
          <div
            key={s.label}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: '1px solid var(--theme-border-color)',
              background: 'var(--theme-bg)',
              textAlign: 'center',
              minWidth: 80,
              flex: 1,
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--theme-elevation-500)', marginTop: 2 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Left: Core Fields */}
        <div style={sectionStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--theme-text)', margin: '0 0 16px', borderBottom: '1px solid var(--theme-border-color)', paddingBottom: 8 }}>
            Core Fields
          </h3>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Status</label>
            <select
              value={status}
              onChange={e => { setStatus(e.target.value); markDirty() }}
              style={{
                ...selectStyle,
                borderColor: statusColor + '60',
                color: statusColor,
                fontWeight: 600,
              }}
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Miss Count</label>
              <input
                type="number"
                min={0}
                value={missCount}
                onChange={e => { setMissCount(parseInt(e.target.value) || 0); markDirty() }}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Current Day</label>
              <input
                type="number"
                min={1}
                max={100}
                value={currentDay}
                onChange={e => { setCurrentDay(parseInt(e.target.value) || 1); markDirty() }}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Payment Type</label>
            <select
              value={paymentType}
              onChange={e => { setPaymentType(e.target.value); markDirty() }}
              style={selectStyle}
            >
              {PAYMENT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Missed Days</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              {missedDays.length === 0 && (
                <span style={{ fontSize: 12, color: 'var(--theme-elevation-400)', fontStyle: 'italic' }}>None</span>
              )}
              {missedDays.map((day) => (
                <span
                  key={day}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 600,
                    background: '#ef444420',
                    color: '#ef4444',
                    border: '1px solid #ef444430',
                    cursor: 'pointer',
                  }}
                  title="Click to remove"
                  onClick={() => {
                    setMissedDays(prev => prev.filter(d => d !== day))
                    markDirty()
                  }}
                >
                  Day {day} ✕
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="number"
                min={1}
                max={100}
                placeholder="Add day..."
                id="add-missed-day"
                style={{ ...inputStyle, flex: 1 }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const input = e.target as HTMLInputElement
                    const val = parseInt(input.value)
                    if (val >= 1 && val <= 100 && !missedDays.includes(val)) {
                      setMissedDays(prev => [...prev, val].sort((a, b) => a - b))
                      input.value = ''
                      markDirty()
                    }
                  }
                }}
              />
              <button
                onClick={() => {
                  const input = document.getElementById('add-missed-day') as HTMLInputElement
                  const val = parseInt(input?.value)
                  if (val >= 1 && val <= 100 && !missedDays.includes(val)) {
                    setMissedDays(prev => [...prev, val].sort((a, b) => a - b))
                    input.value = ''
                    markDirty()
                  }
                }}
                style={btnStyle('#6b7280', true)}
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Right: Dates */}
        <div style={sectionStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--theme-text)', margin: '0 0 16px', borderBottom: '1px solid var(--theme-border-color)', paddingBottom: 8 }}>
            Dates & Timeline
          </h3>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Started At</label>
            <input
              type="datetime-local"
              value={startedAt}
              onChange={e => { setStartedAt(e.target.value); markDirty() }}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Ended At</label>
            <input
              type="datetime-local"
              value={endedAt}
              onChange={e => { setEndedAt(e.target.value); markDirty() }}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Prework Completed At</label>
            <input
              type="datetime-local"
              value={preworkCompletedAt}
              onChange={e => { setPreworkCompletedAt(e.target.value); markDirty() }}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Created</label>
              <div style={{ fontSize: 13, color: 'var(--theme-elevation-500)', padding: '7px 0' }}>
                {fmtDateTime(attempt.createdAt)}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Last Updated</label>
              <div style={{ fontSize: 13, color: 'var(--theme-elevation-500)', padding: '7px 0' }}>
                {fmtDateTime(attempt.updatedAt)}
              </div>
            </div>
          </div>

          {/* Partner/Gate section */}
          {(paymentType === 'sponsored' || paymentType === 'partnership' || partnerDecision) && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 6, background: '#f59e0b08', borderLeft: '3px solid #f59e0b' }}>
              <span style={{ ...labelStyle, color: '#f59e0b' }}>Partner Decision</span>
              <select
                value={partnerDecision}
                onChange={e => { setPartnerDecision(e.target.value); markDirty() }}
                style={selectStyle}
              >
                {PARTNER_DECISION_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}

          {(gateRevisionForDay || gateRevisionDeadline) && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 6, background: '#8b5cf608', borderLeft: '3px solid #8b5cf6' }}>
              <span style={{ ...labelStyle, color: '#8b5cf6' }}>Gate Revision</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={labelStyle}>Day</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={gateRevisionForDay ?? ''}
                    onChange={e => { setGateRevisionForDay(parseInt(e.target.value) || null); markDirty() }}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Deadline</label>
                  <input
                    type="datetime-local"
                    value={gateRevisionDeadline}
                    onChange={e => { setGateRevisionDeadline(e.target.value); markDirty() }}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--theme-text)', margin: '0 0 16px', borderBottom: '1px solid var(--theme-border-color)', paddingBottom: 8 }}>
          Day Timeline
        </h3>
        <AttemptTimeline
          currentDay={currentDay}
          missedDays={missedDays}
          completedDays={completedDays}
        />
      </div>

      {/* Submissions */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--theme-text)', margin: '0 0 16px', borderBottom: '1px solid var(--theme-border-color)', paddingBottom: 8 }}>
          Submissions ({submissions.length})
        </h3>
        {submissions.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--theme-elevation-400)', fontSize: 13 }}>
            No submissions yet.
          </div>
        ) : (
          <div>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '50px 90px 1fr 80px 150px', gap: 8, padding: '6px 8px', borderBottom: '1px solid var(--theme-border-color)' }}>
              {['Day', 'Type', 'Form', 'Backfill', 'Submitted'].map(h => (
                <span key={h} style={labelStyle}>{h}</span>
              ))}
            </div>
            {/* Data rows */}
            {submissions.map(sub => {
              const formTitle = typeof sub.form === 'object' && sub.form ? (sub.form.title || sub.form.slug || '—') : '—'
              return (
                <div
                  key={sub.id}
                  onClick={() => window.open(`/admin/collections/founder-form-submissions/${sub.id}`, '_blank')}
                  style={{ display: 'grid', gridTemplateColumns: '50px 90px 1fr 80px 150px', gap: 8, padding: '8px', borderBottom: '1px solid var(--theme-border-color)', cursor: 'pointer', alignItems: 'center' }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--theme-text)', fontSize: 13 }}>{sub.programDay}</span>
                  <span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 10,
                      fontSize: 10,
                      fontWeight: 600,
                      background: sub.dayType === 'gate' ? '#f59e0b20' : sub.dayType === 'retro' ? '#3b82f620' : 'var(--theme-elevation-100)',
                      color: sub.dayType === 'gate' ? '#f59e0b' : sub.dayType === 'retro' ? '#3b82f6' : 'var(--theme-elevation-600)',
                      textTransform: 'uppercase',
                    }}>
                      {sub.dayType || 'standard'}
                    </span>
                  </span>
                  <span style={{ color: 'var(--theme-elevation-500)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formTitle}</span>
                  <span>
                    {sub.isBackfill && (
                      <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: '#f59e0b15', color: '#f59e0b' }}>BACKFILL</span>
                    )}
                  </span>
                  <span style={{ color: 'var(--theme-elevation-500)', fontSize: 12 }}>{fmtDateTime(sub.createdAt)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Mentor Reviews */}
      {reviews.length > 0 && (
        <div style={sectionStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--theme-text)', margin: '0 0 16px', borderBottom: '1px solid var(--theme-border-color)', paddingBottom: 8 }}>
            Mentor Reviews ({reviews.length})
          </h3>
          <div>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '50px 100px 60px 80px 1fr 120px', gap: 8, padding: '6px 8px', borderBottom: '1px solid var(--theme-border-color)' }}>
              {['Day', 'Score', 'Gate', 'Decision', 'Comment', 'Date'].map(h => (
                <span key={h} style={labelStyle}>{h}</span>
              ))}
            </div>
            {/* Data rows */}
            {reviews.map(r => (
              <div key={r.id} onClick={() => window.open(`/admin/collections/mentor-reviews/${r.id}`, '_blank')} style={{ display: 'grid', gridTemplateColumns: '50px 100px 60px 80px 1fr 120px', gap: 8, padding: '8px', borderBottom: '1px solid var(--theme-border-color)', alignItems: 'center', cursor: 'pointer' }}>
                <span style={{ fontWeight: 600, color: 'var(--theme-text)', fontSize: 13 }}>{r.dayNumber}</span>
                <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: 13 }}>
                  {'★'.repeat(r.score)}{'☆'.repeat(5 - r.score)}
                </span>
                <span>
                  {r.isGateReview && (
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: '#f59e0b20', color: '#f59e0b' }}>GATE</span>
                  )}
                </span>
                <span>
                  {r.gateDecision && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 10,
                      fontSize: 10,
                      fontWeight: 600,
                      background: r.gateDecision === 'pass' ? '#10b98120' : r.gateDecision === 'fail' ? '#ef444420' : '#f59e0b20',
                      color: r.gateDecision === 'pass' ? '#10b981' : r.gateDecision === 'fail' ? '#ef4444' : '#f59e0b',
                      textTransform: 'uppercase',
                    }}>
                      {r.gateDecision}
                    </span>
                  )}
                </span>
                <span style={{ color: 'var(--theme-elevation-500)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.comment || '—'}
                </span>
                <span style={{ color: 'var(--theme-elevation-400)', fontSize: 12 }}>{fmtDate(r.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
