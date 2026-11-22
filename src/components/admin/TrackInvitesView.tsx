'use client'

import React, { useEffect, useMemo, useState } from 'react'

type TrackOption = {
  id: number
  name: string
  slug: string
}

type InviteLink = {
  id: number
  label: string
  token: string
  isActive: boolean
  useCount: number
  lastUsedAt?: string | null
  createdAt?: string | null
  track?: TrackOption | number | null
}

type MeResponse = {
  user?: { id: number }
}

function formatDate(value?: string | null) {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Never'
  return date.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function TrackInvitesView() {
  const [tracks, setTracks] = useState<TrackOption[]>([])
  const [links, setLinks] = useState<InviteLink[]>([])
  const [userId, setUserId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [label, setLabel] = useState('')
  const [trackId, setTrackId] = useState('')
  const [copiedKey, setCopiedKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const appOrigin = typeof window !== 'undefined' ? window.location.origin : ''

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [tracksRes, linksRes, meRes] = await Promise.all([
        fetch('/api/tracks?where[isActive][equals]=true&limit=200&depth=0&sort=name'),
        fetch('/api/track-invite-links?limit=200&depth=2&sort=-createdAt'),
        fetch('/api/users/me'),
      ])

      if (!tracksRes.ok || !linksRes.ok || !meRes.ok) {
        throw new Error('Failed to load track invite data')
      }

      const tracksData = await tracksRes.json()
      const linksData = await linksRes.json()
      const meData = await meRes.json() as MeResponse

      setTracks((tracksData.docs || []).map((track: any) => ({
        id: Number(track.id),
        name: String(track.name || `Track ${track.id}`),
        slug: String(track.slug || ''),
      })))
      setLinks(linksData.docs || [])
      setUserId(meData.user?.id ?? null)
    } catch (nextError: any) {
      setError(nextError?.message || 'Failed to load track invites')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const sortedTracks = useMemo(
    () => [...tracks].sort((a, b) => a.name.localeCompare(b.name)),
    [tracks],
  )

  async function handleCreate() {
    if (!label.trim() || !trackId) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/track-invite-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: label.trim(),
          track: Number(trackId),
          isActive: true,
          createdBy: userId ?? undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.errors?.[0]?.message || data?.message || 'Failed to create invite link')
      }

      setLabel('')
      setTrackId('')
      setSuccess('Track invite created.')
      await load()
    } catch (nextError: any) {
      setError(nextError?.message || 'Failed to create track invite')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(link: InviteLink) {
    setTogglingId(link.id)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/track-invite-links/${link.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !link.isActive }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.errors?.[0]?.message || data?.message || 'Failed to update invite link')
      }

      setSuccess(`Link ${link.isActive ? 'deactivated' : 'activated'}.`)
      await load()
    } catch (nextError: any) {
      setError(nextError?.message || 'Failed to update invite')
    } finally {
      setTogglingId(null)
    }
  }

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey((current) => (current === key ? '' : current)), 1500)
    } catch {
      setError('Clipboard write failed')
    }
  }

  return (
    <div style={{ maxWidth: 1260, margin: '0 auto', padding: '24px 28px 40px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 6px', color: 'var(--theme-text)' }}>Track Invites</h1>
        <p style={{ margin: 0, color: 'var(--theme-elevation-700)', fontSize: 14 }}>
          Generate public and private invite URLs for a selected track inside Payload admin.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 18 }}>
        <section style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 10, background: 'var(--theme-elevation-0)', padding: 18 }}>
          <div style={{ marginBottom: 14 }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 6px', textTransform: 'uppercase', color: 'var(--theme-elevation-700)' }}>
              Create Private Link
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--theme-elevation-700)' }}>
              Private links lock the founder to one specific track. Public URLs are available automatically for every active track.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr auto', gap: 12 }}>
            <input
              type="text"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Internal label"
              style={inputStyle}
            />
            <select value={trackId} onChange={(event) => setTrackId(event.target.value)} style={inputStyle}>
              <option value="">Select track</option>
              {sortedTracks.map((track) => (
                <option key={track.id} value={track.id}>{track.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving || !label.trim() || !trackId}
              style={primaryButtonStyle}
            >
              {saving ? 'Creating...' : 'Generate'}
            </button>
          </div>

          {error && <p style={{ margin: '12px 0 0', color: '#b42318', fontSize: 13 }}>{error}</p>}
          {success && <p style={{ margin: '12px 0 0', color: '#0f9f6e', fontSize: 13 }}>{success}</p>}
        </section>

        <section style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 10, background: 'var(--theme-elevation-0)', padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 6px', textTransform: 'uppercase', color: 'var(--theme-elevation-700)' }}>
                Public Track URLs
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--theme-elevation-700)' }}>
                These URLs preselect a track but do not lock it.
              </p>
            </div>
          </div>

          {loading ? (
            <p style={{ margin: 0, color: 'var(--theme-elevation-700)', fontSize: 14 }}>Loading public track URLs...</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {sortedTracks.map((track) => {
                const publicUrl = `${appOrigin}/invite/track/${track.slug}`
                return (
                  <div key={track.id} style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 10, padding: 12, background: 'var(--theme-elevation-50)', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12, alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{track.name}</div>
                      <div style={{ ...urlValueStyle, marginTop: 4 }}>{publicUrl}</div>
                    </div>
                    <button type="button" onClick={() => void copyText(`public-track-${track.id}`, publicUrl)} style={secondaryButtonStyle}>
                      {copiedKey === `public-track-${track.id}` ? 'Copied' : 'Copy public URL'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 10, background: 'var(--theme-elevation-0)', padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, margin: 0, textTransform: 'uppercase', color: 'var(--theme-elevation-700)' }}>
              Existing Links
            </h2>
            <button type="button" onClick={() => void load()} style={secondaryButtonStyle}>Refresh</button>
          </div>

          {loading ? (
            <p style={{ margin: 0, color: 'var(--theme-elevation-700)', fontSize: 14 }}>Loading track invites...</p>
          ) : links.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--theme-elevation-700)', fontSize: 14 }}>No track invite links yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {links.map((link) => {
                const track = typeof link.track === 'object' && link.track ? link.track : null
                const publicUrl = track?.slug ? `${appOrigin}/invite/track/${track.slug}` : null
                const privateUrl = `${appOrigin}/invite/track-private/${link.token}`

                return (
                  <div key={link.id} style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 10, padding: 14, background: 'var(--theme-elevation-50)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                          <strong style={{ fontSize: 14 }}>{link.label}</strong>
                          <span style={statusBadgeStyle(link.isActive)}>
                            {link.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: 'var(--theme-elevation-700)' }}>
                          <span>{track?.name || 'Unknown track'}</span>
                          <span>Used {Number(link.useCount || 0)} times</span>
                          <span>Last used {formatDate(link.lastUsedAt)}</span>
                          <span>Created {formatDate(link.createdAt)}</span>
                        </div>

                        {publicUrl && (
                          <div style={{ marginTop: 12 }}>
                            <div style={urlLabelStyle}>Public URL</div>
                            <div style={urlValueStyle}>{publicUrl}</div>
                          </div>
                        )}

                        <div style={{ marginTop: 10 }}>
                          <div style={urlLabelStyle}>Private URL</div>
                          <div style={urlValueStyle}>{privateUrl}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
                        {publicUrl && (
                          <button type="button" onClick={() => void copyText(`public-${link.id}`, publicUrl)} style={secondaryButtonStyle}>
                            {copiedKey === `public-${link.id}` ? 'Copied' : 'Copy public URL'}
                          </button>
                        )}
                        <button type="button" onClick={() => void copyText(`private-${link.id}`, privateUrl)} style={secondaryButtonStyle}>
                          {copiedKey === `private-${link.id}` ? 'Copied' : 'Copy private URL'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggle(link)}
                          disabled={togglingId === link.id}
                          style={secondaryButtonStyle}
                        >
                          {togglingId === link.id ? 'Saving...' : link.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 12px',
  borderRadius: 8,
  border: '1px solid var(--theme-elevation-250)',
  background: 'var(--theme-elevation-0)',
  color: 'var(--theme-text)',
  fontSize: 13,
}

const primaryButtonStyle: React.CSSProperties = {
  border: '1px solid #ffcc00',
  borderRadius: 8,
  padding: '11px 16px',
  background: '#ffcc00',
  color: '#fff',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-250)',
  borderRadius: 999,
  padding: '9px 12px',
  background: 'var(--theme-elevation-0)',
  color: 'var(--theme-text)',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
}

const urlLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  textTransform: 'uppercase',
  color: 'var(--theme-elevation-800)',
  marginBottom: 4,
}

const urlValueStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--theme-text)',
  wordBreak: 'break-all',
}

function statusBadgeStyle(active: boolean): React.CSSProperties {
  return {
    borderRadius: 999,
    padding: '3px 8px',
    fontSize: 10,
    fontWeight: 800,
    textTransform: 'uppercase',
    border: `1px solid ${active ? 'rgba(44,177,161,0.35)' : 'rgba(255,255,255,0.12)'}`,
    color: active ? '#2CB1A1' : 'var(--theme-elevation-800)',
    background: active ? 'rgba(44,177,161,0.12)' : 'rgba(255,255,255,0.04)',
  }
}
