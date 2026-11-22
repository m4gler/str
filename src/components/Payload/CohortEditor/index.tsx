'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'

// ── Types ──

type Partner = {
  id: number | string
  name: string
}

type Cohort = {
  id: number | string
  name: string
  slug: string
  timezone: string
  startDate: string | null
  preworkStartDate: string | null
  partner: Partner | number | string | null
  isActive: boolean
  description: string
  maxMembers: number | null
  // UI state
  _dirty?: boolean
}

// ── Styles ──

const inputStyle: React.CSSProperties = {
  padding: '7px 10px', background: 'var(--theme-input-bg)',
  border: '1px solid var(--theme-border-color)', borderRadius: 4,
  fontSize: 13, color: 'var(--theme-text)', outline: 'none',
  width: '100%', boxSizing: 'border-box',
}
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.05em', color: 'var(--theme-elevation-600)',
  marginBottom: 4, display: 'block',
}
const cardStyle: React.CSSProperties = {
  border: '1px solid var(--theme-border-color)',
  borderRadius: 8, padding: 16, marginBottom: 12, background: 'var(--theme-bg)',
}
const btnStyle = (color: string): React.CSSProperties => ({
  padding: '8px 16px', background: color, color: '#fff',
  border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
})

// ── Helpers ──

function getPartnerName(partner: Partner | number | string | null): string | null {
  if (!partner) return null
  if (typeof partner === 'object' && 'name' in partner) return partner.name
  return null
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return d
  }
}

function toDateInputValue(d: string | null): string {
  if (!d) return ''
  try {
    return new Date(d).toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

// ── Cohort Card ──

function CohortCard({
  cohort, onSave,
}: {
  cohort: Cohort
  onSave: (c: Cohort) => Promise<void>
}) {
  const [c, setC] = useState<Cohort>(cohort)
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const dirty = useRef(false)

  useEffect(() => { setC(cohort) }, [cohort])

  const set = (key: keyof Cohort, val: any) => {
    dirty.current = true
    setC(prev => ({ ...prev, [key]: val }))
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave(c)
    dirty.current = false
    setSaving(false)
  }

  const partnerName = getPartnerName(c.partner)

  return (
    <div style={{
      ...cardStyle,
      borderLeft: `4px solid ${c.isActive ? '#10b981' : '#6b7280'}`,
      marginBottom: 8,
      background: expanded ? 'var(--theme-bg)' : 'transparent',
    }}>
      {/* Header row (collapsed) */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontSize: 18, fontWeight: 300, color: 'var(--theme-elevation-400)', width: 24, textAlign: 'center' }}>
          {expanded ? '▾' : '▸'}
        </span>

        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--theme-text)' }}>
          {c.name || 'Untitled'}
        </span>

        <span style={{
          fontSize: 12, fontFamily: 'monospace', color: 'var(--theme-elevation-500)',
        }}>
          {c.slug}
        </span>

        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
          background: c.isActive ? '#10b98120' : '#6b728020',
          color: c.isActive ? '#10b981' : '#6b7280',
        }}>
          {c.isActive ? 'ACTIVE' : 'INACTIVE'}
        </span>

        <span style={{ fontSize: 11, color: 'var(--theme-elevation-500)' }}>
          {c.timezone}
        </span>

        <span style={{ fontSize: 11, color: 'var(--theme-elevation-500)' }}>
          {formatDate(c.startDate)}
        </span>

        {partnerName && (
          <span style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 4,
            background: '#8b5cf620', color: '#8b5cf6',
          }}>
            {partnerName}
          </span>
        )}

        <div style={{ flex: 1 }} />

        {dirty.current && (
          <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>UNSAVED</span>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input style={inputStyle} value={c.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Slug</label>
              <input style={inputStyle} value={c.slug} onChange={e => set('slug', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={labelStyle}>Timezone</label>
              <input style={inputStyle} value={c.timezone} onChange={e => set('timezone', e.target.value)} placeholder="Europe/Warsaw" />
            </div>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input style={inputStyle} type="date" value={toDateInputValue(c.startDate)} onChange={e => set('startDate', e.target.value || null)} />
            </div>
            <div>
              <label style={labelStyle}>Prework Start Date</label>
              <input style={inputStyle} type="date" value={toDateInputValue(c.preworkStartDate)} onChange={e => set('preworkStartDate', e.target.value || null)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={labelStyle}>Partner</label>
              {partnerName ? (
                <div style={{ ...inputStyle, background: 'var(--theme-elevation-50)', color: 'var(--theme-elevation-600)' }}>
                  {partnerName}
                </div>
              ) : (
                <div style={{ ...inputStyle, background: 'var(--theme-elevation-50)', color: 'var(--theme-elevation-400)', fontStyle: 'italic' }}>
                  None
                </div>
              )}
              <span style={{ fontSize: 10, color: 'var(--theme-elevation-400)', marginTop: 2, display: 'block' }}>
                Use Payload admin to change partner relationship
              </span>
            </div>
            <div>
              <label style={labelStyle}>Is Active</label>
              <div style={{ marginTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--theme-text)' }}>
                  <input type="checkbox" checked={c.isActive} onChange={e => set('isActive', e.target.checked)} />
                  {c.isActive ? 'Active' : 'Inactive'}
                </label>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Max Members</label>
              <input style={inputStyle} type="number" value={c.maxMembers ?? ''} onChange={e => set('maxMembers', e.target.value ? Number(e.target.value) : null)} placeholder="Unlimited" />
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, minHeight: 70 }} value={c.description} onChange={e => set('description', e.target.value)} placeholder="Internal notes about this cohort..." />
          </div>

          {/* Save button */}
          <div style={{ display: 'flex', gap: 10, paddingTop: 12, borderTop: '1px solid var(--theme-border-color)', justifyContent: 'flex-end' }}>
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

export default function CohortEditor() {
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 })
  const [creating, setCreating] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/cohorts?limit=200&depth=1&sort=-createdAt')
      const data = await res.json()

      const allCohorts: Cohort[] = (data.docs || []).map((d: any) => ({
        id: d.id,
        name: d.name || '',
        slug: d.slug || '',
        timezone: d.timezone || 'Europe/Warsaw',
        startDate: d.startDate || null,
        preworkStartDate: d.preworkStartDate || null,
        partner: d.partner || null,
        isActive: d.isActive ?? true,
        description: d.description || '',
        maxMembers: d.maxMembers ?? null,
      }))

      setCohorts(allCohorts)

      const active = allCohorts.filter(c => c.isActive).length
      setStats({ total: allCohorts.length, active, inactive: allCohorts.length - active })
    } catch (err: any) {
      setMessage({ text: `Failed to load: ${err.message}`, type: 'error' })
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async (c: Cohort) => {
    try {
      const body: any = {
        name: c.name,
        slug: c.slug,
        timezone: c.timezone,
        startDate: c.startDate,
        preworkStartDate: c.preworkStartDate,
        isActive: c.isActive,
        description: c.description,
        maxMembers: c.maxMembers,
      }
      const res = await fetch(`/api/cohorts/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await res.text())
      setMessage({ text: `Saved: ${c.name}`, type: 'success' })
      setTimeout(() => setMessage(null), 3000)
      fetchData()
    } catch (err: any) {
      setMessage({ text: `Save failed: ${err.message}`, type: 'error' })
    }
  }

  const handleCreate = async () => {
    setCreating(true)
    try {
      const now = Date.now()
      const body = {
        name: `New Cohort ${now}`,
        slug: `cohort-${now}`,
        timezone: 'Europe/Warsaw',
        isActive: true,
        description: '',
      }
      const res = await fetch('/api/cohorts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await res.text())
      setMessage({ text: 'Cohort created', type: 'success' })
      setTimeout(() => setMessage(null), 3000)
      fetchData()
    } catch (err: any) {
      setMessage({ text: `Create failed: ${err.message}`, type: 'error' })
    }
    setCreating(false)
  }

  // Filter and search
  const filtered = cohorts.filter(c => {
    if (filter === 'active' && !c.isActive) return false
    if (filter === 'inactive' && c.isActive) return false
    if (search) {
      const s = search.toLowerCase()
      return (
        c.name.toLowerCase().includes(s) ||
        c.slug.toLowerCase().includes(s)
      )
    }
    return true
  })

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--theme-elevation-500)' }}>Loading cohorts...</div>
  }

  return (
    <div style={{ padding: 20, maxWidth: 1100 }}>
      {/* Header + Stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--theme-text)', margin: 0 }}>Cohorts</h2>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: `${stats.total} Total`, color: '#3b82f6' },
            { label: `${stats.active} Active`, color: '#10b981' },
            { label: `${stats.inactive} Inactive`, color: '#6b7280' },
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

      {/* Create button */}
      <div style={{ ...cardStyle, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
        <button style={btnStyle('#3b82f6')} onClick={handleCreate} disabled={creating}>
          {creating ? 'Creating...' : '+ New Cohort'}
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {([
            { label: `All (${stats.total})`, value: 'all' as const },
            { label: `Active (${stats.active})`, value: 'active' as const },
            { label: `Inactive (${stats.inactive})`, value: 'inactive' as const },
          ]).map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              style={{
                ...btnStyle(filter === f.value ? '#3b82f6' : '#6b728040'),
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
          style={{ ...inputStyle, width: 250 }}
          placeholder="Search by name or slug..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
          Showing {filtered.length} of {cohorts.length}
        </span>
      </div>

      {/* Cohort list */}
      <div>
        {filtered.map(c => (
          <CohortCard
            key={c.id}
            cohort={c}
            onSave={handleSave}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--theme-elevation-400)' }}>
            No cohorts found. Create one to get started.
          </div>
        )}
      </div>
    </div>
  )
}
