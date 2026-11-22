'use client'

import React, { useEffect, useState, useCallback } from 'react'

// ── Types ──

type ReviewDoc = {
  id: number | string
  submission: { id: number; email: string; programDay: number | null } | number
  reviewer: { id: number; email: string } | number
  dayNumber: number | null
  score: number | null
  comment: string | null
  internalNote: string | null
  isRetro: boolean
  isGateReview: boolean
  gateDecision: string | null
  gateChecklistCompleted: any
  evidencePackUrl: string | null
  createdAt: string
  updatedAt: string
  // UI state
  _dirty?: boolean
  _expanded?: boolean
}

type FilterMode = 'all' | 'gate' | 'retro'

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

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--theme-border-color)',
  borderRadius: 8,
  padding: 16,
  marginBottom: 12,
  background: 'var(--theme-bg)',
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

const badgeStyle = (bg: string, fg: string, border?: string): React.CSSProperties => ({
  padding: '2px 7px',
  borderRadius: 10,
  fontSize: 10,
  fontWeight: 700,
  background: bg,
  color: fg,
  border: border ? `1px solid ${border}` : 'none',
  whiteSpace: 'nowrap',
})

const filterBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '5px 14px',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  border: active ? '1px solid #3b82f6' : '1px solid var(--theme-border-color)',
  background: active ? '#3b82f615' : 'transparent',
  color: active ? '#3b82f6' : 'var(--theme-elevation-500)',
  transition: 'all 0.15s ease',
})

const statCardStyle: React.CSSProperties = {
  padding: '12px 20px',
  borderRadius: 8,
  background: 'var(--theme-elevation-50)',
  border: '1px solid var(--theme-border-color)',
  textAlign: 'center',
  minWidth: 120,
}

// ── Helpers ──

function getReviewerEmail(r: ReviewDoc): string {
  return typeof r.reviewer === 'object' && r.reviewer ? r.reviewer.email : '—'
}

function getSubmissionEmail(r: ReviewDoc): string {
  return typeof r.submission === 'object' && r.submission ? r.submission.email : '—'
}

function gateDecisionBadge(decision: string | null) {
  if (!decision) return null
  const map: Record<string, { bg: string; fg: string }> = {
    pass: { bg: '#10b98120', fg: '#10b981' },
    fail: { bg: '#ef444420', fg: '#ef4444' },
    revise: { bg: '#f59e0b20', fg: '#f59e0b' },
  }
  const c = map[decision] || { bg: '#6b728020', fg: '#6b7280' }
  return (
    <span style={badgeStyle(c.bg, c.fg)}>
      {decision.toUpperCase()}
    </span>
  )
}

function renderStars(score: number | null) {
  if (score == null) return <span style={{ color: 'var(--theme-elevation-400)', fontSize: 12 }}>no score</span>
  return (
    <span style={{ fontSize: 14, letterSpacing: 1 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} style={{ color: n <= score ? '#f59e0b' : 'var(--theme-elevation-300)' }}>
          {n <= score ? '\u2605' : '\u2606'}
        </span>
      ))}
    </span>
  )
}

// ── Component ──

export default function MentorReviewEditor() {
  const [reviews, setReviews] = useState<ReviewDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [search, setSearch] = useState('')
  const [savingId, setSavingId] = useState<string | number | null>(null)

  // ── Fetch all reviews ──

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/mentor-reviews?limit=500&depth=1&sort=-createdAt')
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`)
      const data = await res.json()
      const docs: ReviewDoc[] = (data.docs || []).map((d: ReviewDoc) => ({
        ...d,
        _dirty: false,
        _expanded: false,
      }))
      setReviews(docs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  // ── Field update ──

  const updateField = (id: string | number, key: string, value: any) => {
    setReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [key]: value, _dirty: true } : r)),
    )
  }

  const toggleExpanded = (id: string | number) => {
    setReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, _expanded: !r._expanded } : r)),
    )
  }

  // ── Save single review ──

  const handleSave = async (review: ReviewDoc) => {
    setSavingId(review.id)
    try {
      const res = await fetch(`/api/mentor-reviews/${review.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: review.score,
          comment: review.comment,
          internalNote: review.internalNote,
          gateDecision: review.gateDecision,
          evidencePackUrl: review.evidencePackUrl,
        }),
      })
      if (res.ok) {
        setReviews((prev) =>
          prev.map((r) => (r.id === review.id ? { ...r, _dirty: false } : r)),
        )
      } else {
        alert('Failed to save review.')
      }
    } catch {
      alert('An error occurred while saving.')
    } finally {
      setSavingId(null)
    }
  }

  // ── Filtering & search ──

  const filtered = reviews.filter((r) => {
    if (filter === 'gate' && !r.isGateReview) return false
    if (filter === 'retro' && !r.isRetro) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const dayStr = r.dayNumber != null ? String(r.dayNumber) : ''
    const reviewerEmail = getReviewerEmail(r).toLowerCase()
    const submissionEmail = getSubmissionEmail(r).toLowerCase()
    const comment = (r.comment || '').toLowerCase()
    const note = (r.internalNote || '').toLowerCase()
    return (
      dayStr.includes(q) ||
      reviewerEmail.includes(q) ||
      submissionEmail.includes(q) ||
      comment.includes(q) ||
      note.includes(q)
    )
  })

  // ── Stats ──

  const totalReviews = reviews.length
  const gateCount = reviews.filter((r) => r.isGateReview).length
  const scoredReviews = reviews.filter((r) => r.score != null)
  const avgScore =
    scoredReviews.length > 0
      ? (scoredReviews.reduce((sum, r) => sum + (r.score || 0), 0) / scoredReviews.length).toFixed(
          1,
        )
      : '—'

  // ── Render ──

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--theme-elevation-500)' }}>
        Loading mentor reviews...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 40 }}>
        <div style={{ color: '#ef4444', marginBottom: 12 }}>Error: {error}</div>
        <button onClick={fetchReviews} style={btnStyle('#3b82f6')}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 40px', maxWidth: 1000 }}>
      {/* Header */}
      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: 'var(--theme-text)',
          margin: '0 0 20px',
        }}
      >
        Mentor Reviews
      </h1>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={statCardStyle}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--theme-text)' }}>
            {totalReviews}
          </div>
          <div style={{ fontSize: 11, color: 'var(--theme-elevation-500)', marginTop: 2 }}>
            Total Reviews
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#ef4444' }}>{gateCount}</div>
          <div style={{ fontSize: 11, color: 'var(--theme-elevation-500)', marginTop: 2 }}>
            Gate Reviews
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b' }}>{avgScore}</div>
          <div style={{ fontSize: 11, color: 'var(--theme-elevation-500)', marginTop: 2 }}>
            Avg Score
          </div>
        </div>
      </div>

      {/* Filters & search */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 20,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <button style={filterBtnStyle(filter === 'all')} onClick={() => setFilter('all')}>
          All
        </button>
        <button style={filterBtnStyle(filter === 'gate')} onClick={() => setFilter('gate')}>
          Gate Reviews
        </button>
        <button style={filterBtnStyle(filter === 'retro')} onClick={() => setFilter('retro')}>
          Retro Reviews
        </button>
        <div style={{ flex: 1 }} />
        <input
          style={{ ...inputStyle, maxWidth: 280 }}
          placeholder="Search by day, email, comment..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Results count */}
      <div
        style={{
          fontSize: 12,
          color: 'var(--theme-elevation-500)',
          marginBottom: 12,
        }}
      >
        Showing {filtered.length} of {totalReviews} reviews
      </div>

      {/* Review cards */}
      {filtered.length === 0 && (
        <div
          style={{
            padding: 40,
            textAlign: 'center',
            color: 'var(--theme-elevation-400)',
            border: '1px dashed var(--theme-border-color)',
            borderRadius: 8,
          }}
        >
          No reviews match the current filter.
        </div>
      )}

      {filtered.map((review) => {
        const reviewerEmail = getReviewerEmail(review)
        const submissionEmail = getSubmissionEmail(review)

        return (
          <div key={review.id} style={cardStyle}>
            {/* Card header (collapsed view) */}
            <div
              onClick={() => toggleExpanded(review.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                userSelect: 'none',
                flexWrap: 'wrap',
              }}
            >
              {/* Expand arrow */}
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--theme-elevation-400)',
                  transition: 'transform 0.15s',
                  transform: review._expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  display: 'inline-block',
                  width: 16,
                  textAlign: 'center',
                  flexShrink: 0,
                }}
              >
                {'\u25B6'}
              </span>

              {/* Day number */}
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--theme-text)',
                  minWidth: 60,
                }}
              >
                Day {review.dayNumber ?? '—'}
              </span>

              {/* Score stars */}
              {renderStars(review.score)}

              {/* Reviewer */}
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--theme-elevation-500)',
                  maxWidth: 180,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={`Reviewer: ${reviewerEmail}`}
              >
                {reviewerEmail}
              </span>

              {/* Submission email */}
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--theme-elevation-400)',
                  maxWidth: 180,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={`Submission: ${submissionEmail}`}
              >
                {'\u2192'} {submissionEmail}
              </span>

              {/* Badges */}
              <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
                {review._dirty && (
                  <span style={badgeStyle('#f59e0b20', '#f59e0b', '#f59e0b40')}>UNSAVED</span>
                )}
                {review.isRetro && (
                  <span style={badgeStyle('#f59e0b20', '#f59e0b', '#f59e0b30')}>RETRO</span>
                )}
                {review.isGateReview && (
                  <span style={badgeStyle('#ef444420', '#ef4444', '#ef444430')}>GATE</span>
                )}
                {review.isGateReview && review.gateDecision && gateDecisionBadge(review.gateDecision)}
              </div>
            </div>

            {/* Expanded content */}
            {review._expanded && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--theme-border-color)' }}>
                {/* Score selector */}
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Score</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => updateField(review.id, 'score', n)}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 16,
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: `2px solid ${review.score === n ? '#3b82f6' : 'var(--theme-border-color)'}`,
                          background: review.score === n ? '#3b82f620' : 'transparent',
                          color: review.score === n ? '#3b82f6' : 'var(--theme-elevation-500)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {n}
                      </button>
                    ))}
                    <span
                      style={{
                        marginLeft: 4,
                        fontSize: 12,
                        color: 'var(--theme-elevation-400)',
                      }}
                    >
                      / 5
                    </span>
                  </div>
                </div>

                {/* Comment */}
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Feedback Comment (visible to founder)</label>
                  <textarea
                    style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                    value={review.comment || ''}
                    onChange={(e) => updateField(review.id, 'comment', e.target.value)}
                    placeholder="Feedback for the founder..."
                  />
                </div>

                {/* Internal Note */}
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Internal Note (admin only)</label>
                  <textarea
                    style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }}
                    value={review.internalNote || ''}
                    onChange={(e) => updateField(review.id, 'internalNote', e.target.value)}
                    placeholder="Internal notes..."
                  />
                </div>

                {/* Gate section */}
                {review.isGateReview && (
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 6,
                      border: '1px solid #ef444430',
                      borderLeft: '3px solid #ef4444',
                      background: '#ef444408',
                      marginBottom: 16,
                    }}
                  >
                    <label
                      style={{
                        ...labelStyle,
                        color: '#ef4444',
                        marginBottom: 12,
                        fontSize: 12,
                      }}
                    >
                      Gate Decision
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div>
                        <label style={labelStyle}>Decision</label>
                        <select
                          style={selectStyle}
                          value={review.gateDecision || ''}
                          onChange={(e) =>
                            updateField(review.id, 'gateDecision', e.target.value || null)
                          }
                        >
                          <option value="">— Select —</option>
                          <option value="pass">Pass</option>
                          <option value="fail">Fail</option>
                          <option value="revise">Revise</option>
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Evidence Pack URL</label>
                        <input
                          style={inputStyle}
                          value={review.evidencePackUrl || ''}
                          onChange={(e) =>
                            updateField(review.id, 'evidencePackUrl', e.target.value)
                          }
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Save button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--theme-elevation-400)',
                      alignSelf: 'center',
                    }}
                  >
                    Updated {new Date(review.updatedAt).toLocaleString()}
                  </span>
                  <button
                    onClick={() => handleSave(review)}
                    disabled={!review._dirty || savingId === review.id}
                    style={{
                      ...btnStyle(review._dirty ? '#3b82f6' : '#6b7280'),
                      opacity: review._dirty ? 1 : 0.5,
                      cursor: review._dirty ? 'pointer' : 'default',
                    }}
                  >
                    {savingId === review.id ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
