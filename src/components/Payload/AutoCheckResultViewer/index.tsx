'use client'

import React, { useEffect, useState, useCallback } from 'react'

// ── Types ──

type UserRef = { id: number | string; email?: string; name?: string } | number | string
type SubmissionRef = { id: number | string } | number | string

type AiSummary = {
  summary_3s?: string
  key_output?: string
  decision?: string
  learnings?: string
  mentor_ask?: string
  checks_passed?: boolean
  link_reachable?: boolean
  generated_at?: string
}

type AutoCheckResult = {
  id: number | string
  submission: SubmissionRef
  user: UserRef
  attempt?: { id: number | string } | number | string | null
  dayNumber: number
  checksPassed: boolean
  linkReachable: boolean
  linkUrl?: string | null
  proofType?: string | null
  aiSummary?: AiSummary | null
  autoCheckDetails?: Record<string, unknown> | null
  errorMessage?: string | null
  createdAt: string
  updatedAt: string
}

type FilterMode = 'all' | 'passed' | 'failed'

// ── Helpers ──

function getUserEmail(user: UserRef): string {
  if (typeof user === 'object' && user !== null && 'email' in user) return user.email || `User #${user.id}`
  return `User #${user}`
}

function getSubmissionId(sub: SubmissionRef): string {
  if (typeof sub === 'object' && sub !== null && 'id' in sub) return String(sub.id)
  return String(sub)
}

const PROOF_LABELS: Record<string, string> = {
  link: 'Link',
  video_link: 'Video',
  file_pdf: 'PDF',
  file_ppt: 'PPT',
  file_doc: 'DOC',
  text: 'Text',
  audio_link: 'Audio',
}

function proofLabel(type?: string | null): string {
  if (!type) return '—'
  return PROOF_LABELS[type] || type
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

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

const btnStyle = (color: string): React.CSSProperties => ({
  padding: '8px 16px',
  background: color,
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
})

const badgeStyle = (bg: string, fg: string): React.CSSProperties => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 700,
  background: bg,
  color: fg,
  marginRight: 8,
})

const statsBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  padding: '12px 16px',
  marginBottom: 16,
  borderRadius: 8,
  border: '1px solid var(--theme-border-color)',
  background: 'var(--theme-elevation-50)',
  flexWrap: 'wrap',
  alignItems: 'center',
}

const statItemStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--theme-text)',
}

const statValueStyle = (color?: string): React.CSSProperties => ({
  fontWeight: 700,
  fontSize: 16,
  color: color || 'var(--theme-text)',
  marginLeft: 4,
})

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  cursor: 'pointer',
  userSelect: 'none',
  flexWrap: 'wrap',
}

const detailSectionStyle: React.CSSProperties = {
  marginTop: 14,
  paddingTop: 14,
  borderTop: '1px solid var(--theme-border-color)',
}

const jsonFieldStyle: React.CSSProperties = {
  marginBottom: 10,
}

const jsonLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--theme-elevation-500)',
  marginBottom: 2,
}

const jsonValueStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--theme-text)',
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}

const preStyle: React.CSSProperties = {
  background: 'var(--theme-elevation-50)',
  border: '1px solid var(--theme-border-color)',
  borderRadius: 6,
  padding: 12,
  fontSize: 12,
  overflow: 'auto',
  maxHeight: 300,
  color: 'var(--theme-text)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}

const filterBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginBottom: 16,
  flexWrap: 'wrap',
  alignItems: 'center',
}

// ── Component ──

const AutoCheckResultViewer: React.FC = () => {
  const [results, setResults] = useState<AutoCheckResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string | number>>(new Set())
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [search, setSearch] = useState('')

  const fetchResults = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auto-check-results?limit=500&depth=1&sort=-createdAt')
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`)
      const data = await res.json()
      setResults(data.docs || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchResults()
  }, [fetchResults])

  // ── Filtering ──

  const filtered = results.filter((r) => {
    if (filterMode === 'passed' && !r.checksPassed) return false
    if (filterMode === 'failed' && r.checksPassed) return false

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const email = getUserEmail(r.user).toLowerCase()
      const dayStr = String(r.dayNumber)
      if (!email.includes(q) && !dayStr.includes(q)) return false
    }

    return true
  })

  // ── Stats ──

  const totalCount = results.length
  const passedCount = results.filter((r) => r.checksPassed).length
  const failedCount = totalCount - passedCount
  const passedPct = totalCount > 0 ? ((passedCount / totalCount) * 100).toFixed(1) : '0'

  // ── Toggle ──

  const toggle = (id: string | number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Render AI Summary ──

  const renderAiSummary = (summary: AiSummary) => {
    const fields: { key: keyof AiSummary; label: string }[] = [
      { key: 'summary_3s', label: '3-Second Summary' },
      { key: 'key_output', label: 'Key Output' },
      { key: 'decision', label: 'Decision' },
      { key: 'learnings', label: 'Learnings' },
      { key: 'mentor_ask', label: 'Mentor Ask' },
      { key: 'checks_passed', label: 'Checks Passed' },
      { key: 'link_reachable', label: 'Link Reachable' },
      { key: 'generated_at', label: 'Generated At' },
    ]

    return (
      <div>
        {fields.map(({ key, label }) => {
          const val = summary[key]
          if (val === undefined || val === null) return null
          let display: string
          if (typeof val === 'boolean') display = val ? 'Yes' : 'No'
          else display = String(val)
          return (
            <div key={key} style={jsonFieldStyle}>
              <div style={jsonLabelStyle}>{label}</div>
              <div style={jsonValueStyle}>{display}</div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Render ──

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--theme-elevation-500)' }}>
        Loading auto-check results...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ color: '#ef4444', marginBottom: 12 }}>Error: {error}</div>
        <button style={btnStyle('#3b82f6')} onClick={fetchResults}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 24px', maxWidth: 960, margin: '0 auto' }}>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--theme-text)',
          marginBottom: 16,
        }}
      >
        Auto-Check Results
      </h2>

      {/* Stats bar */}
      <div style={statsBarStyle}>
        <span style={statItemStyle}>
          Total:<span style={statValueStyle()}>{totalCount}</span>
        </span>
        <span style={statItemStyle}>
          Passed:<span style={statValueStyle('#22c55e')}>{passedCount} ({passedPct}%)</span>
        </span>
        <span style={statItemStyle}>
          Failed:<span style={statValueStyle('#ef4444')}>{failedCount}</span>
        </span>
        <div style={{ flex: 1 }} />
        <button style={btnStyle('#3b82f6')} onClick={fetchResults}>
          Refresh
        </button>
      </div>

      {/* Filters & search */}
      <div style={filterBarStyle}>
        {(['all', 'passed', 'failed'] as FilterMode[]).map((mode) => {
          const isActive = filterMode === mode
          const colors: Record<FilterMode, string> = {
            all: '#6b7280',
            passed: '#22c55e',
            failed: '#ef4444',
          }
          return (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              style={{
                ...btnStyle(isActive ? colors[mode] : 'transparent'),
                color: isActive ? '#fff' : 'var(--theme-text)',
                border: isActive ? 'none' : '1px solid var(--theme-border-color)',
                textTransform: 'capitalize',
              }}
            >
              {mode}
            </button>
          )
        })}
        <div style={{ flex: 1, minWidth: 180, maxWidth: 320 }}>
          <input
            style={inputStyle}
            placeholder="Search by email or day number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Results count */}
      <div
        style={{
          fontSize: 12,
          color: 'var(--theme-elevation-500)',
          marginBottom: 12,
        }}
      >
        Showing {filtered.length} of {totalCount} results
      </div>

      {/* Cards */}
      {filtered.length === 0 && (
        <div
          style={{
            padding: 40,
            textAlign: 'center',
            color: 'var(--theme-elevation-400)',
            fontSize: 14,
          }}
        >
          No results match the current filters.
        </div>
      )}

      {filtered.map((r) => {
        const isExpanded = expandedIds.has(r.id)
        const email = getUserEmail(r.user)
        const hasError = !!r.errorMessage

        return (
          <div key={r.id} style={cardStyle}>
            {/* Header (collapsed view) */}
            <div style={headerRowStyle} onClick={() => toggle(r.id)}>
              <span
                style={{
                  fontSize: 14,
                  color: 'var(--theme-elevation-500)',
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s',
                  display: 'inline-block',
                  width: 16,
                  flexShrink: 0,
                }}
              >
                &#9654;
              </span>

              {/* Day number badge */}
              <span style={badgeStyle('#3b82f6', '#fff')}>Day {r.dayNumber}</span>

              {/* User email */}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--theme-text)',
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {email}
              </span>

              {/* Checks passed indicator */}
              <span
                title={r.checksPassed ? 'Checks passed' : 'Checks failed'}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: r.checksPassed ? '#22c55e' : '#ef4444',
                  flexShrink: 0,
                }}
              >
                {r.checksPassed ? '\u2714' : '\u2718'} Checks
              </span>

              {/* Link reachable indicator */}
              <span
                title={r.linkReachable ? 'Link reachable' : 'Link unreachable'}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: r.linkReachable ? '#22c55e' : '#ef4444',
                  flexShrink: 0,
                }}
              >
                {r.linkReachable ? '\u2714' : '\u2718'} Link
              </span>

              {/* Proof type badge */}
              {r.proofType && (
                <span style={badgeStyle('#8b5cf620', '#8b5cf6')}>{proofLabel(r.proofType)}</span>
              )}

              {/* Error indicator */}
              {hasError && (
                <span
                  title={r.errorMessage || 'Error'}
                  style={badgeStyle('#ef444420', '#ef4444')}
                >
                  Error
                </span>
              )}
            </div>

            {/* Expanded detail view */}
            {isExpanded && (
              <div style={detailSectionStyle}>
                {/* Top info grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <span style={labelStyle}>Submission ID</span>
                    <span style={{ fontSize: 13, color: 'var(--theme-text)' }}>
                      {getSubmissionId(r.submission)}
                    </span>
                  </div>
                  <div>
                    <span style={labelStyle}>Proof Type</span>
                    <span style={{ fontSize: 13, color: 'var(--theme-text)' }}>
                      {proofLabel(r.proofType)}
                    </span>
                  </div>
                  <div>
                    <span style={labelStyle}>Checks Passed</span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: r.checksPassed ? '#22c55e' : '#ef4444',
                      }}
                    >
                      {r.checksPassed ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div>
                    <span style={labelStyle}>Link Reachable</span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: r.linkReachable ? '#22c55e' : '#ef4444',
                      }}
                    >
                      {r.linkReachable ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>

                {/* Link URL */}
                {r.linkUrl && (
                  <div style={{ marginBottom: 12 }}>
                    <span style={labelStyle}>Link URL</span>
                    <a
                      href={r.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 13,
                        color: '#3b82f6',
                        textDecoration: 'underline',
                        wordBreak: 'break-all',
                      }}
                    >
                      {r.linkUrl}
                    </a>
                  </div>
                )}

                {/* Error message */}
                {r.errorMessage && (
                  <div
                    style={{
                      marginBottom: 14,
                      padding: '10px 12px',
                      background: '#ef444410',
                      border: '1px solid #ef444440',
                      borderRadius: 6,
                    }}
                  >
                    <span style={{ ...labelStyle, color: '#ef4444' }}>Error Message</span>
                    <div style={{ fontSize: 13, color: '#ef4444', fontWeight: 500 }}>
                      {r.errorMessage}
                    </div>
                  </div>
                )}

                {/* AI Summary */}
                {r.aiSummary && typeof r.aiSummary === 'object' && (
                  <div style={{ marginBottom: 14 }}>
                    <span
                      style={{
                        ...labelStyle,
                        fontSize: 12,
                        marginBottom: 8,
                        color: '#8b5cf6',
                      }}
                    >
                      AI Summary
                    </span>
                    <div
                      style={{
                        background: 'var(--theme-elevation-50)',
                        border: '1px solid var(--theme-border-color)',
                        borderRadius: 6,
                        padding: 14,
                      }}
                    >
                      {renderAiSummary(r.aiSummary)}
                    </div>
                  </div>
                )}

                {/* Auto-check details */}
                {r.autoCheckDetails && typeof r.autoCheckDetails === 'object' && (
                  <div style={{ marginBottom: 14 }}>
                    <span style={{ ...labelStyle, fontSize: 12, marginBottom: 8 }}>
                      Auto-Check Details
                    </span>
                    <pre style={preStyle}>{JSON.stringify(r.autoCheckDetails, null, 2)}</pre>
                  </div>
                )}

                {/* Timestamps */}
                <div
                  style={{
                    display: 'flex',
                    gap: 24,
                    flexWrap: 'wrap',
                    marginTop: 10,
                  }}
                >
                  <div>
                    <span style={labelStyle}>Created</span>
                    <span style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
                      {formatDate(r.createdAt)}
                    </span>
                  </div>
                  <div>
                    <span style={labelStyle}>Updated</span>
                    <span style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
                      {formatDate(r.updatedAt)}
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

export default AutoCheckResultViewer
