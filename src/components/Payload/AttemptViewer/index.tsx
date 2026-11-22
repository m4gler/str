'use client'

import React, { useEffect, useState, useCallback } from 'react'

// ── Types ──

type AttemptDoc = {
  id: number | string
  user: { id: number; email: string } | number
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
  createdAt: string
  updatedAt: string
}

// ── Styles ──

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--theme-border-color)',
  borderRadius: 8,
  padding: 16,
  marginBottom: 12,
  background: 'var(--theme-bg)',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--theme-elevation-600)',
  marginBottom: 4,
  display: 'block',
}

const valueStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--theme-text)',
  marginBottom: 12,
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: '#10b98120', text: '#10b981', label: 'Active' },
  warned_1: { bg: '#f59e0b20', text: '#f59e0b', label: 'Warned 1/3' },
  warned_2: { bg: '#ef444420', text: '#ef4444', label: 'Warned 2/3' },
  completed: { bg: '#3b82f620', text: '#3b82f6', label: 'Completed' },
  failed: { bg: '#ef444420', text: '#ef4444', label: 'Failed' },
}

const PAYMENT_LABELS: Record<string, string> = {
  self_paid: 'Self-Paid',
  paid: 'Paid',
  free: 'Free',
  test: 'Test',
  sponsored: 'Sponsored',
  partnership: 'Partnership',
}

type FilterKey = 'all' | 'active' | 'warned_1' | 'warned_2' | 'completed' | 'failed'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'warned_1', label: 'Warned 1' },
  { key: 'warned_2', label: 'Warned 2' },
  { key: 'completed', label: 'Completed' },
  { key: 'failed', label: 'Failed' },
]

// ── Helpers ──

function getUserEmail(a: AttemptDoc): string {
  return typeof a.user === 'object' && a.user ? a.user.email : `User #${a.user}`
}

function getCohort(a: AttemptDoc): { name: string; timezone: string } | null {
  return typeof a.cohort === 'object' && a.cohort ? a.cohort : null
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString()
}

function fmtDateTime(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}

// ── Component ──

export default function AttemptViewer() {
  const [attempts, setAttempts] = useState<AttemptDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string | number>>(new Set())

  const fetchAttempts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/attempts?limit=500&depth=1&sort=-createdAt')
      if (!res.ok) throw new Error('Failed to fetch attempts')
      const data = await res.json()
      setAttempts(data.docs || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAttempts()
  }, [fetchAttempts])

  const toggleExpand = useCallback((id: string | number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // ── Filtering ──

  const filtered = attempts.filter((a) => {
    if (filter !== 'all' && a.status !== filter) return false
    if (search.trim()) {
      const email = getUserEmail(a).toLowerCase()
      if (!email.includes(search.trim().toLowerCase())) return false
    }
    return true
  })

  // ── Stats ──

  const stats = {
    total: attempts.length,
    active: attempts.filter((a) => a.status === 'active').length,
    warned: attempts.filter((a) => a.status === 'warned_1' || a.status === 'warned_2').length,
    completed: attempts.filter((a) => a.status === 'completed').length,
    failed: attempts.filter((a) => a.status === 'failed').length,
  }

  // ── Render ──

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--theme-elevation-500)' }}>
        Loading attempts...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 40, color: '#ef4444' }}>
        Error: {error}
        <button
          onClick={fetchAttempts}
          style={{
            marginLeft: 12,
            padding: '6px 12px',
            borderRadius: 4,
            border: '1px solid var(--theme-border-color)',
            background: 'var(--theme-bg)',
            color: 'var(--theme-text)',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 40px', maxWidth: 1000 }}>
      {/* Title */}
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--theme-text)', margin: '0 0 20px' }}>
        Attempt Viewer
      </h1>

      {/* Stats Bar */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        {[
          { label: 'Total', value: stats.total, color: 'var(--theme-text)' },
          { label: 'Active', value: stats.active, color: '#10b981' },
          { label: 'Warned', value: stats.warned, color: '#f59e0b' },
          { label: 'Completed', value: stats.completed, color: '#3b82f6' },
          { label: 'Failed', value: stats.failed, color: '#ef4444' },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: '1px solid var(--theme-border-color)',
              background: 'var(--theme-bg)',
              textAlign: 'center',
              minWidth: 80,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--theme-elevation-500)', marginTop: 2 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filters & Search */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '5px 12px',
                borderRadius: 16,
                border: '1px solid',
                borderColor: filter === f.key ? 'var(--theme-text)' : 'var(--theme-border-color)',
                background: filter === f.key ? 'var(--theme-text)' : 'var(--theme-bg)',
                color: filter === f.key ? 'var(--theme-bg)' : 'var(--theme-text)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search by email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid var(--theme-border-color)',
            background: 'var(--theme-bg)',
            color: 'var(--theme-text)',
            fontSize: 13,
            flex: '1 1 200px',
            maxWidth: 300,
            outline: 'none',
          }}
        />
        <span style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Attempt Cards */}
      {filtered.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--theme-elevation-500)' }}>
          No attempts match the current filters.
        </div>
      )}

      {filtered.map((a) => {
        const expanded = expandedIds.has(a.id)
        const statusInfo = STATUS_COLORS[a.status] || STATUS_COLORS.active
        const cohort = getCohort(a)
        const missedDays = a.missedDays || []

        return (
          <div key={a.id} style={cardStyle}>
            {/* Collapsed Header */}
            <div
              onClick={() => toggleExpand(a.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                userSelect: 'none',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: 14, color: 'var(--theme-elevation-400)', fontWeight: 600, width: 18 }}>
                {expanded ? '\u25BC' : '\u25B6'}
              </span>

              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--theme-text)', minWidth: 160 }}>
                {getUserEmail(a)}
              </span>

              <span style={{ fontSize: 12, color: 'var(--theme-elevation-500)', fontWeight: 600 }}>
                Attempt #{a.attemptNumber}
              </span>

              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 700,
                  background: statusInfo.bg,
                  color: statusInfo.text,
                  border: `1px solid ${statusInfo.text}30`,
                  whiteSpace: 'nowrap',
                }}
              >
                {statusInfo.label}
              </span>

              <span style={{ fontSize: 12, color: a.missCount > 0 ? '#ef4444' : 'var(--theme-elevation-500)', fontWeight: 600 }}>
                {a.missCount}/3 misses
              </span>

              <span style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
                Day {a.currentDay || 0}/100
              </span>

              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 8,
                  background: 'var(--theme-elevation-100)',
                  color: 'var(--theme-elevation-600)',
                  fontWeight: 600,
                  marginLeft: 'auto',
                }}
              >
                {PAYMENT_LABELS[a.paymentType] || a.paymentType}
              </span>
            </div>

            {/* Expanded Body */}
            {expanded && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--theme-border-color)' }}>
                {/* Miss counter visual */}
                <div style={{ marginBottom: 16 }}>
                  <span style={labelStyle}>Miss Counter</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {[1, 2, 3].map((n) => (
                      <div
                        key={n}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 13,
                          fontWeight: 700,
                          border: `2px solid ${n <= a.missCount ? '#ef4444' : 'var(--theme-border-color)'}`,
                          background: n <= a.missCount ? '#ef444420' : 'transparent',
                          color: n <= a.missCount ? '#ef4444' : 'var(--theme-elevation-500)',
                        }}
                      >
                        {n <= a.missCount ? '\u2717' : n}
                      </div>
                    ))}
                    <span style={{ fontSize: 12, color: 'var(--theme-elevation-500)', marginLeft: 4 }}>
                      {a.missCount}/3 misses
                    </span>
                  </div>
                </div>

                {/* Day progress bar */}
                <div style={{ marginBottom: 16 }}>
                  <span style={labelStyle}>Day Progress</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--theme-elevation-500)' }}>Day {a.currentDay || 0}</span>
                    <span style={{ fontSize: 11, color: 'var(--theme-elevation-500)' }}>Day 100</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--theme-elevation-100)', borderRadius: 4, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${((a.currentDay || 0) / 100) * 100}%`,
                        background: `linear-gradient(90deg, ${statusInfo.text}, ${statusInfo.text}80)`,
                        borderRadius: 4,
                        transition: 'width 0.5s ease',
                      }}
                    />
                  </div>
                </div>

                {/* Details grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <span style={labelStyle}>Payment Type</span>
                    <span style={valueStyle}>{PAYMENT_LABELS[a.paymentType] || a.paymentType}</span>
                  </div>
                  <div>
                    <span style={labelStyle}>Started</span>
                    <span style={valueStyle}>{fmtDate(a.startedAt)}</span>
                  </div>
                  <div>
                    <span style={labelStyle}>Ended</span>
                    <span style={valueStyle}>{fmtDate(a.endedAt)}</span>
                  </div>
                </div>

                {/* Missed Days */}
                {missedDays.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <span style={labelStyle}>Missed Days</span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {missedDays.map((day) => (
                        <span
                          key={day}
                          style={{
                            padding: '3px 10px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 600,
                            background: '#ef444420',
                            color: '#ef4444',
                            border: '1px solid #ef444430',
                          }}
                        >
                          Day {day}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Partner Override */}
                {a.partnerOverrideRequestedAt && (
                  <div
                    style={{
                      marginBottom: 16,
                      padding: 12,
                      borderRadius: 6,
                      borderLeft: '3px solid #f59e0b',
                      background: '#f59e0b08',
                    }}
                  >
                    <span style={{ ...labelStyle, color: '#f59e0b' }}>Partner Override</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <span style={labelStyle}>Requested At</span>
                        <span style={valueStyle}>{fmtDateTime(a.partnerOverrideRequestedAt)}</span>
                      </div>
                      <div>
                        <span style={labelStyle}>Decision</span>
                        <span
                          style={{
                            ...valueStyle,
                            fontWeight: 700,
                            color:
                              a.partnerDecision === 'granted'
                                ? '#10b981'
                                : a.partnerDecision === 'ended'
                                  ? '#ef4444'
                                  : '#f59e0b',
                          }}
                        >
                          {a.partnerDecision === 'granted'
                            ? 'Granted Extra Attempt'
                            : a.partnerDecision === 'ended'
                              ? 'Process Ended'
                              : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cohort & Prework */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <span style={labelStyle}>Cohort</span>
                    <span style={valueStyle}>{cohort ? `${cohort.name} (${cohort.timezone})` : 'None'}</span>
                  </div>
                  <div>
                    <span style={labelStyle}>Prework Completed</span>
                    <span style={valueStyle}>{a.preworkCompletedAt ? fmtDate(a.preworkCompletedAt) : 'Not yet'}</span>
                  </div>
                </div>

                {/* Timestamps */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <span style={labelStyle}>Created</span>
                    <span style={{ ...valueStyle, fontSize: 12, color: 'var(--theme-elevation-500)' }}>
                      {fmtDateTime(a.createdAt)}
                    </span>
                  </div>
                  <div>
                    <span style={labelStyle}>Last Updated</span>
                    <span style={{ ...valueStyle, fontSize: 12, color: 'var(--theme-elevation-500)' }}>
                      {fmtDateTime(a.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
