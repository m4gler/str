'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'

// ── Types ──

type EcosystemDoc = {
  id: number | string
  user: { id: number; email: string } | number
  itemType: string
  name: string
  description: string | null
  url: string | null
  status: string
  priority: string
  notes: string | null
  eventDate: string | null
  location: { city: string | null; country: string | null; lat: number | null; lng: number | null }
  createdAt: string
  updatedAt: string
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
  marginBottom: 8,
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

// ── Constants ──

const ITEM_TYPES = [
  { label: 'Online Group', value: 'online_group', icon: '\u{1F310}', color: '#3b82f6' },
  { label: 'Physical Place / Coworking', value: 'physical_place', icon: '\u{1F3E2}', color: '#8b5cf6' },
  { label: 'Upcoming Event', value: 'event', icon: '\u{1F4C5}', color: '#f59e0b' },
  { label: 'Angel / VC / Fund', value: 'angel_vc', icon: '\u{1F4B0}', color: '#10b981' },
  { label: 'Operator / Mentor', value: 'operator', icon: '\u{1F464}', color: '#06b6d4' },
  { label: 'Signal Account', value: 'signal_account', icon: '\u{1F4E1}', color: '#ec4899' },
]

const STATUSES = [
  { label: 'Identified', value: 'identified', color: '#6b7280' },
  { label: 'Contacted', value: 'contacted', color: '#f59e0b' },
  { label: 'Engaged', value: 'engaged', color: '#3b82f6' },
  { label: 'Active Relationship', value: 'active', color: '#10b981' },
  { label: 'Archived', value: 'archived', color: '#9ca3af' },
]

const PRIORITIES = [
  { label: 'High', value: 'high', color: '#ef4444' },
  { label: 'Medium', value: 'medium', color: '#f59e0b' },
  { label: 'Low', value: 'low', color: '#6b7280' },
]

function getTypeInfo(itemType: string) {
  return ITEM_TYPES.find(t => t.value === itemType)
}

function getStatusInfo(status: string) {
  return STATUSES.find(s => s.value === status)
}

function getPriorityInfo(priority: string) {
  return PRIORITIES.find(p => p.value === priority)
}

// ── Item Card ──

function EcosystemItemCard({
  item: initialItem,
  onSaved,
}: {
  item: EcosystemDoc
  onSaved: () => void
}) {
  const [item, setItem] = useState<EcosystemDoc>(initialItem)
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const dirty = useRef(false)

  useEffect(() => { setItem(initialItem) }, [initialItem])

  const set = (key: keyof EcosystemDoc, val: any) => {
    dirty.current = true
    setItem(prev => ({ ...prev, [key]: val }))
  }

  const setLocation = (key: string, val: any) => {
    dirty.current = true
    setItem(prev => ({ ...prev, location: { ...prev.location, [key]: val } }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/ecosystem-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType: item.itemType,
          name: item.name,
          description: item.description,
          url: item.url,
          status: item.status,
          priority: item.priority,
          notes: item.notes,
          eventDate: item.eventDate,
          location: item.location,
        }),
      })
      if (res.ok) {
        dirty.current = false
        onSaved()
      } else {
        alert('Failed to save.')
      }
    } catch {
      alert('An error occurred.')
    } finally {
      setSaving(false)
    }
  }

  const typeInfo = getTypeInfo(item.itemType)
  const statusInfo = getStatusInfo(item.status)
  const priorityInfo = getPriorityInfo(item.priority)
  const user = typeof item.user === 'object' ? item.user : null
  const typeColor = typeInfo?.color || '#6b7280'

  return (
    <div style={{
      ...cardStyle,
      borderLeft: `4px solid ${typeColor}`,
      background: expanded ? 'var(--theme-bg)' : 'transparent',
    }}>
      {/* Collapsed header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontSize: 18, fontWeight: 300, color: 'var(--theme-elevation-400)', width: 24, textAlign: 'center' }}>
          {expanded ? '\u25BE' : '\u25B8'}
        </span>
        <span style={{ fontSize: 18 }}>{typeInfo?.icon || '\u{1F4CC}'}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.name || 'Untitled'}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
          background: typeColor + '20', color: typeColor, whiteSpace: 'nowrap',
        }}>
          {typeInfo?.label || item.itemType}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
          background: (statusInfo?.color || '#6b7280') + '20',
          color: statusInfo?.color || '#6b7280',
        }}>
          {statusInfo?.label || item.status}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
          background: (priorityInfo?.color || '#6b7280') + '20',
          color: priorityInfo?.color || '#6b7280',
        }}>
          {priorityInfo?.label || item.priority}
        </span>
        {user && (
          <span style={{ fontSize: 11, color: 'var(--theme-elevation-500)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.email}
          </span>
        )}
        {dirty.current && <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>UNSAVED</span>}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ marginTop: 16 }}>
          {/* Main fields */}
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--theme-text)', marginBottom: 12, borderBottom: '1px solid var(--theme-border-color)', paddingBottom: 6 }}>
              Details
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={labelStyle}>Name</label>
                <input style={inputStyle} value={item.name || ''} onChange={e => set('name', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Type</label>
                <select style={selectStyle} value={item.itemType} onChange={e => set('itemType', e.target.value)}>
                  {ITEM_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>URL</label>
              <input style={inputStyle} value={item.url || ''} onChange={e => set('url', e.target.value)} placeholder="https://..." />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Description</label>
              <textarea
                style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                value={item.description || ''}
                onChange={e => set('description', e.target.value)}
              />
            </div>
          </div>

          {/* Status, Priority, Event Date */}
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--theme-text)', marginBottom: 12, borderBottom: '1px solid var(--theme-border-color)', paddingBottom: 6 }}>
              Status &amp; Priority
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: item.itemType === 'event' ? '1fr 1fr 1fr' : '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Status</label>
                <select style={selectStyle} value={item.status} onChange={e => set('status', e.target.value)}>
                  {STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Priority</label>
                <select style={selectStyle} value={item.priority} onChange={e => set('priority', e.target.value)}>
                  {PRIORITIES.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              {item.itemType === 'event' && (
                <div>
                  <label style={labelStyle}>Event Date</label>
                  <input
                    type="date"
                    style={inputStyle}
                    value={item.eventDate?.split('T')[0] || ''}
                    onChange={e => set('eventDate', e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Location */}
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--theme-text)', marginBottom: 12, borderBottom: '1px solid var(--theme-border-color)', paddingBottom: 6 }}>
              Location
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>City</label>
                <input style={inputStyle} value={item.location?.city || ''} onChange={e => setLocation('city', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Country</label>
                <input style={inputStyle} value={item.location?.country || ''} onChange={e => setLocation('country', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Latitude</label>
                <input type="number" step="0.000001" style={inputStyle} value={item.location?.lat ?? ''} onChange={e => setLocation('lat', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div>
                <label style={labelStyle}>Longitude</label>
                <input type="number" step="0.000001" style={inputStyle} value={item.location?.lng ?? ''} onChange={e => setLocation('lng', e.target.value ? Number(e.target.value) : null)} />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Notes</label>
            <textarea
              style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
              value={item.notes || ''}
              onChange={e => set('notes', e.target.value)}
              placeholder="Interaction notes, follow-ups, context..."
            />
          </div>

          {/* Save button */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--theme-border-color)' }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 11, color: 'var(--theme-elevation-500)' }}>
                Created: {new Date(item.createdAt).toLocaleDateString()} · Updated: {new Date(item.updatedAt).toLocaleDateString()}
              </span>
            </div>
            <button style={btnStyle('#10b981')} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── New Item Form ──

function NewItemForm({
  currentUserId,
  onCreated,
  onCancel,
}: {
  currentUserId: number
  onCreated: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [itemType, setItemType] = useState('online_group')
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/ecosystem-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          itemType,
          user: currentUserId,
          status: 'identified',
          priority: 'medium',
          location: { city: null, country: null, lat: null, lng: null },
        }),
      })
      if (res.ok) {
        onCreated()
        setName('')
        setItemType('online_group')
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data?.errors?.[0]?.message || 'Failed to create item.')
      }
    } catch {
      alert('An error occurred.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div style={{ ...cardStyle, borderLeft: '4px solid #3b82f6', marginBottom: 16 }}>
      <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--theme-text)', marginTop: 0, marginBottom: 12 }}>New Ecosystem Item</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Name</label>
          <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Item name..." autoFocus />
        </div>
        <div>
          <label style={labelStyle}>Type</label>
          <select style={selectStyle} value={itemType} onChange={e => setItemType(e.target.value)}>
            {ITEM_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={btnStyle('#10b981')} onClick={handleCreate} disabled={creating || !name.trim()}>
          {creating ? 'Creating...' : 'Create'}
        </button>
        <button style={btnStyle('#6b7280')} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

// ── Main Editor ──

export default function EcosystemItemEditor() {
  const [items, setItems] = useState<EcosystemDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [stats, setStats] = useState<Record<string, number>>({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ecosystem-items?limit=500&depth=1&sort=-createdAt')
      const data = await res.json()
      const docs: EcosystemDoc[] = (data.docs || []).map((d: any) => ({
        id: d.id,
        user: d.user,
        itemType: d.itemType || 'online_group',
        name: d.name || '',
        description: d.description || null,
        url: d.url || null,
        status: d.status || 'identified',
        priority: d.priority || 'medium',
        notes: d.notes || null,
        eventDate: d.eventDate || null,
        location: d.location || { city: null, country: null, lat: null, lng: null },
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      }))
      setItems(docs)

      // Compute stats by type
      const s: Record<string, number> = { total: docs.length }
      for (const t of ITEM_TYPES) {
        s[t.value] = docs.filter(d => d.itemType === t.value).length
      }
      setStats(s)
    } catch (err: any) {
      setMessage({ text: `Failed to load: ${err.message}`, type: 'error' })
    }
    setLoading(false)
  }, [])

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await fetch('/api/users/me')
      const data = await res.json()
      if (data.user?.id) {
        setCurrentUserId(data.user.id)
      }
    } catch {
      // silently fail
    }
  }, [])

  useEffect(() => {
    fetchData()
    fetchCurrentUser()
  }, [fetchData, fetchCurrentUser])

  const handleItemSaved = () => {
    setMessage({ text: 'Item saved successfully.', type: 'success' })
    setTimeout(() => setMessage(null), 3000)
    fetchData()
  }

  const handleItemCreated = () => {
    setMessage({ text: 'New item created.', type: 'success' })
    setTimeout(() => setMessage(null), 3000)
    setShowNewForm(false)
    fetchData()
  }

  // Filter and search
  const filtered = items.filter(d => {
    if (filterType !== 'all' && d.itemType !== filterType) return false
    if (filterStatus !== 'all' && d.status !== filterStatus) return false
    if (search) {
      const s = search.toLowerCase()
      const userName = typeof d.user === 'object' ? d.user.email : ''
      return (
        d.name.toLowerCase().includes(s) ||
        (d.description || '').toLowerCase().includes(s) ||
        userName.toLowerCase().includes(s)
      )
    }
    return true
  })

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--theme-elevation-500)' }}>Loading ecosystem items...</div>
  }

  return (
    <div style={{ padding: 20, maxWidth: 1100 }}>
      {/* Header + Stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--theme-text)', margin: 0 }}>Ecosystem Items</h2>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ITEM_TYPES.map(t => (
            <span key={t.value} style={{
              fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
              background: t.color + '15', color: t.color,
            }}>
              {t.icon} {stats[t.value] || 0}
            </span>
          ))}
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
            background: '#6b728015', color: '#6b7280',
          }}>
            Total: {stats.total || 0}
          </span>
        </div>
        <button
          style={{ ...btnStyle('#3b82f6'), padding: '6px 14px', fontSize: 16, lineHeight: '1' }}
          onClick={() => setShowNewForm(true)}
          title="Add new ecosystem item"
        >
          +
        </button>
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

      {/* New Item Form */}
      {showNewForm && currentUserId && (
        <NewItemForm
          currentUserId={currentUserId}
          onCreated={handleItemCreated}
          onCancel={() => setShowNewForm(false)}
        />
      )}
      {showNewForm && !currentUserId && (
        <div style={{ ...cardStyle, marginBottom: 16, color: '#ef4444', fontSize: 13 }}>
          Unable to determine current user. Please refresh the page.
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Type filter */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { label: `All (${stats.total || 0})`, value: 'all' },
            ...ITEM_TYPES.map(t => ({ label: `${t.icon} (${stats[t.value] || 0})`, value: t.value })),
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setFilterType(f.value)}
              style={{
                ...btnStyle(filterType === f.value ? '#3b82f6' : '#6b728040'),
                color: filterType === f.value ? '#fff' : 'var(--theme-text)',
                padding: '5px 10px',
                fontSize: 11,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        {/* Status filter */}
        <select
          style={{ ...selectStyle, width: 160 }}
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="all">All Statuses</option>
          {STATUSES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        {/* Search */}
        <input
          style={{ ...inputStyle, width: 250 }}
          placeholder="Search name, description, email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
          Showing {filtered.length} of {items.length}
        </span>
      </div>

      {/* Items list */}
      <div>
        {filtered.map(item => (
          <EcosystemItemCard
            key={item.id}
            item={item}
            onSaved={handleItemSaved}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--theme-elevation-400)' }}>
            No ecosystem items found. Click + to add one.
          </div>
        )}
      </div>
    </div>
  )
}
