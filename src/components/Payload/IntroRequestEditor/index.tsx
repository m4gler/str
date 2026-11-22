'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'

// ── Types ──

type UserRef = {
  id: number | string
  email?: string
  name?: string
} | number | string | null

type IntroRequest = {
  id: number | string
  user: UserRef
  targetName: string
  targetRole: string
  targetOrganization: string
  targetUrl: string
  reason: string
  status: 'requested' | 'in_progress' | 'completed' | 'declined'
  assignedTo: UserRef
  adminNotes: string
  completedAt: string
  declineReason: string
  createdAt: string
  updatedAt: string
  // UI state
  _dirty?: boolean
}

// ── Constants ──

const STATUS_OPTIONS = [
  { label: 'Requested', value: 'requested', color: '#f59e0b' },
  { label: 'In Progress', value: 'in_progress', color: '#3b82f6' },
  { label: 'Completed', value: 'completed', color: '#10b981' },
  { label: 'Declined', value: 'declined', color: '#ef4444' },
] as const

function getStatusColor(status: string): string {
  return STATUS_OPTIONS.find(s => s.value === status)?.color || '#6b7280'
}

function getStatusLabel(status: string): string {
  return STATUS_OPTIONS.find(s => s.value === status)?.label || status
}

function getUserEmail(ref: UserRef): string {
  if (!ref) return '—'
  if (typeof ref === 'object' && 'email' in ref) return ref.email || '—'
  return `User #${ref}`
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

const readOnlyStyle: React.CSSProperties = {
  ...inputStyle,
  background: 'var(--theme-elevation-50)',
  cursor: 'default',
  opacity: 0.85,
}

// ── Intro Request Card ──

function IntroRequestCard({
  request,
  onSave,
}: {
  request: IntroRequest
  onSave: (r: IntroRequest) => void
}) {
  const [r, setR] = useState<IntroRequest>(request)
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const dirty = useRef(false)

  useEffect(() => { setR(request) }, [request])

  const set = (key: keyof IntroRequest, val: any) => {
    dirty.current = true
    setR(prev => ({ ...prev, [key]: val }))
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave(r)
    dirty.current = false
    setSaving(false)
  }

  const statusColor = getStatusColor(r.status)
  const userEmail = getUserEmail(r.user)
  const assignedEmail = getUserEmail(r.assignedTo)
  const createdDate = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''

  return (
    <div style={{
      ...cardStyle,
      borderLeft: `4px solid ${statusColor}`,
      marginBottom: 8,
      background: expanded ? 'var(--theme-bg)' : 'transparent',
    }}>
      {/* Header row (collapsed) */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', flexWrap: 'wrap' }}
      >
        <span style={{ fontSize: 18, fontWeight: 300, color: 'var(--theme-elevation-400)', width: 24, textAlign: 'center' }}>
          {expanded ? '▾' : '▸'}
        </span>

        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--theme-text)' }}>
          {r.targetName || 'Unnamed'}
        </span>

        {r.targetOrganization && (
          <span style={{ fontSize: 12, color: 'var(--theme-elevation-600)' }}>
            @ {r.targetOrganization}
          </span>
        )}

        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
          background: statusColor + '20', color: statusColor, whiteSpace: 'nowrap',
          textTransform: 'uppercase',
        }}>
          {getStatusLabel(r.status)}
        </span>

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 11, color: 'var(--theme-elevation-500)' }} title="Requested by">
          {userEmail}
        </span>

        {r.assignedTo && (
          <span style={{ fontSize: 11, color: 'var(--theme-elevation-500)', fontStyle: 'italic' }} title="Assigned to">
            → {assignedEmail}
          </span>
        )}

        <span style={{ fontSize: 10, color: 'var(--theme-elevation-400)' }}>
          {createdDate}
        </span>

        {dirty.current && <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>UNSAVED</span>}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ marginTop: 16 }}>
          {/* Founder-set fields (read-only) */}
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--theme-text)', marginBottom: 12, borderBottom: '1px solid var(--theme-border-color)', paddingBottom: 6 }}>
              Request Details (founder-submitted)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={labelStyle}>Target Name</label>
                <input style={readOnlyStyle} value={r.targetName} readOnly />
              </div>
              <div>
                <label style={labelStyle}>Target Role</label>
                <input style={readOnlyStyle} value={r.targetRole} readOnly />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={labelStyle}>Target Organization</label>
                <input style={readOnlyStyle} value={r.targetOrganization} readOnly />
              </div>
              <div>
                <label style={labelStyle}>Target URL</label>
                {r.targetUrl ? (
                  <a href={r.targetUrl} target="_blank" rel="noopener noreferrer" style={{ ...readOnlyStyle, display: 'block', color: '#3b82f6', textDecoration: 'underline' }}>
                    {r.targetUrl}
                  </a>
                ) : (
                  <input style={readOnlyStyle} value="—" readOnly />
                )}
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Reason for Introduction</label>
              <textarea style={{ ...readOnlyStyle, minHeight: 60, resize: 'vertical' }} value={r.reason} readOnly />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Requested By</label>
                <input style={readOnlyStyle} value={userEmail} readOnly />
              </div>
              <div>
                <label style={labelStyle}>Created At</label>
                <input style={readOnlyStyle} value={r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'} readOnly />
              </div>
            </div>
          </div>

          {/* Admin-editable fields */}
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--theme-text)', marginBottom: 12, borderBottom: '1px solid var(--theme-border-color)', paddingBottom: 6 }}>
              Admin Controls
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={labelStyle}>Status</label>
                <select
                  style={selectStyle}
                  value={r.status}
                  onChange={e => set('status', e.target.value)}
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Assigned To</label>
                <input style={readOnlyStyle} value={assignedEmail} readOnly />
                <span style={{ fontSize: 10, color: 'var(--theme-elevation-500)', marginTop: 2, display: 'block' }}>
                  Use Payload admin to change assignee
                </span>
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Admin Notes</label>
              <textarea
                style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                value={r.adminNotes}
                onChange={e => set('adminNotes', e.target.value)}
                placeholder="Internal notes about this request..."
              />
            </div>

            {/* Completed At — only if status=completed */}
            {r.status === 'completed' && (
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Completed At</label>
                <input
                  style={inputStyle}
                  type="datetime-local"
                  value={r.completedAt ? r.completedAt.slice(0, 16) : ''}
                  onChange={e => set('completedAt', e.target.value ? new Date(e.target.value).toISOString() : '')}
                />
              </div>
            )}

            {/* Decline Reason — only if status=declined */}
            {r.status === 'declined' && (
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Decline Reason</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                  value={r.declineReason}
                  onChange={e => set('declineReason', e.target.value)}
                  placeholder="Reason for declining this request..."
                />
              </div>
            )}
          </div>

          {/* Save button */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--theme-border-color)' }}>
            <div style={{ flex: 1 }} />
            <button style={btnStyle('#10b981')} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Editor ──

export default function IntroRequestEditor() {
  const [requests, setRequests] = useState<IntroRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [stats, setStats] = useState({ total: 0, requested: 0, in_progress: 0, completed: 0, declined: 0 })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/intro-requests?limit=500&depth=1&sort=-createdAt')
      const data = await res.json()

      const allRequests: IntroRequest[] = (data.docs || []).map((d: any) => ({
        id: d.id,
        user: d.user || null,
        targetName: d.targetName || '',
        targetRole: d.targetRole || '',
        targetOrganization: d.targetOrganization || '',
        targetUrl: d.targetUrl || '',
        reason: d.reason || '',
        status: d.status || 'requested',
        assignedTo: d.assignedTo || null,
        adminNotes: d.adminNotes || '',
        completedAt: d.completedAt || '',
        declineReason: d.declineReason || '',
        createdAt: d.createdAt || '',
        updatedAt: d.updatedAt || '',
      }))

      setRequests(allRequests)

      const s = { total: allRequests.length, requested: 0, in_progress: 0, completed: 0, declined: 0 }
      for (const r of allRequests) {
        if (r.status === 'requested') s.requested++
        else if (r.status === 'in_progress') s.in_progress++
        else if (r.status === 'completed') s.completed++
        else if (r.status === 'declined') s.declined++
      }
      setStats(s)
    } catch (err: any) {
      setMessage({ text: `Failed to load: ${err.message}`, type: 'error' })
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async (r: IntroRequest) => {
    try {
      const body: Record<string, any> = {
        status: r.status,
        adminNotes: r.adminNotes,
        completedAt: r.completedAt || null,
        declineReason: r.declineReason,
      }

      const res = await fetch(`/api/intro-requests/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await res.text())
      setMessage({ text: `Saved: ${r.targetName}`, type: 'success' })
      setTimeout(() => setMessage(null), 3000)
      fetchData()
    } catch (err: any) {
      setMessage({ text: `Save failed: ${err.message}`, type: 'error' })
    }
  }

  // Filter and search
  const filtered = requests.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false
    if (search) {
      const s = search.toLowerCase()
      const userEmail = getUserEmail(r.user).toLowerCase()
      return (
        r.targetName.toLowerCase().includes(s) ||
        r.targetOrganization.toLowerCase().includes(s) ||
        userEmail.includes(s)
      )
    }
    return true
  })

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--theme-elevation-500)' }}>Loading intro requests...</div>
  }

  return (
    <div style={{ padding: 20, maxWidth: 1100 }}>
      {/* Header + Stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--theme-text)', margin: 0 }}>Intro Requests</h2>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: `${stats.total} Total`, color: '#6b7280' },
            { label: `${stats.requested} Requested`, color: '#f59e0b' },
            { label: `${stats.in_progress} In Progress`, color: '#3b82f6' },
            { label: `${stats.completed} Completed`, color: '#10b981' },
            { label: `${stats.declined} Declined`, color: '#ef4444' },
          ].map((s, i) => (
            <span key={i} style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: s.color + '15', color: s.color }}>
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 12,
          background: message.type === 'success' ? '#10b98115' : '#ef444415',
          border: `1px solid ${message.type === 'success' ? '#10b98140' : '#ef444440'}`,
          color: message.type === 'success' ? '#10b981' : '#ef4444',
          fontSize: 13, fontWeight: 500,
        }}>
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { label: `All (${stats.total})`, value: 'all' },
            { label: `Requested (${stats.requested})`, value: 'requested' },
            { label: `In Progress (${stats.in_progress})`, value: 'in_progress' },
            { label: `Completed (${stats.completed})`, value: 'completed' },
            { label: `Declined (${stats.declined})`, value: 'declined' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              style={{
                ...btnStyle(filter === f.value ? (getStatusColor(f.value) !== '#6b7280' ? getStatusColor(f.value) : '#3b82f6') : '#6b728040'),
                color: filter === f.value ? '#fff' : 'var(--theme-text)',
                padding: '5px 12px',
                fontSize: 12,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          style={{ ...inputStyle, width: 280 }}
          placeholder="Search name, organization, user email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
          Showing {filtered.length} of {requests.length}
        </span>
      </div>

      {/* Requests list */}
      <div>
        {filtered.map(r => (
          <IntroRequestCard
            key={r.id}
            request={r}
            onSave={handleSave}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--theme-elevation-400)' }}>
            No intro requests found.
          </div>
        )}
      </div>
    </div>
  )
}
