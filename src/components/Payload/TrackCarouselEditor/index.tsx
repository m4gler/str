'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

type ChallengeKey = 'general' | 'education' | 'space' | 'urban' | 'other' | 'dualuse'

type Challenge = {
  key: string
  title: string
  desc: string
}

type Track = {
  key: string
  icon: string
  name: string
  enabled: boolean
  badge: string
  tagline: string
  desc: string
  color: string
  applyUrl: string
  applyButtonText: string
  startTrack: any | null
  partners: any[]
  challenges: Challenge[]
  whatYouGet: Array<{ text: string }>
  graphic: any | null
}

type PartnerOption = {
  id: number | string
  name: string
  logoUrl: string | null
}

type MediaOption = {
  id: number | string
  filename: string
  url: string | null
  alt: string
}

type TrackOption = {
  id: number | string
  name: string
  slug: string
  isActive: boolean
}

const CHALLENGE_PILLS: Array<{ key: ChallengeKey; label: string }> = [
  { key: 'general', label: 'General' },
  { key: 'education', label: 'Education' },
  { key: 'space', label: 'Space' },
  { key: 'urban', label: 'Urban' },
  { key: 'other', label: 'Other' },
  { key: 'dualuse', label: 'Dual Use' },
]

const TRACK_PRESETS: Record<string, ChallengeKey[]> = {
  general: ['general'],
  edutech: ['education'],
  satc: ['space', 'urban', 'other'],
  dadu: ['dualuse'],
}

const blankTrack = (): Track => ({
  key: `track-${Date.now()}`,
  icon: '🚀',
  name: 'New Track',
  enabled: true,
  badge: 'New cohort',
  tagline: 'Define the focus.',
  desc: '',
  color: '#ffcc00',
  applyUrl: '/login?role=founder',
  applyButtonText: 'Apply for this track →',
  startTrack: null,
  partners: [],
  challenges: [{ key: 'general', title: 'General', desc: '' }],
  whatYouGet: [{ text: '' }],
  graphic: null,
})

function relationId(value: any): number | string | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') return value
  return value.id ?? null
}

function normalizeTrack(raw: any): Track {
  return {
    key: raw?.key || '',
    icon: raw?.icon || '🚀',
    name: raw?.name || '',
    enabled: raw?.enabled !== false,
    badge: raw?.badge || '',
    tagline: raw?.tagline || '',
    desc: raw?.desc || '',
    color: raw?.color || '#ffcc00',
    applyUrl: raw?.applyUrl || '/login?role=founder',
    applyButtonText: raw?.applyButtonText || `Apply for ${raw?.name || 'this track'} →`,
    startTrack: raw?.startTrack || null,
    partners: Array.isArray(raw?.partners) ? raw.partners : [],
    challenges: Array.isArray(raw?.challenges)
      ? raw.challenges.map((challenge: any) => ({
        key: challenge?.key || 'general',
        title: challenge?.title || challenge?.key || '',
        desc: challenge?.desc || '',
      }))
      : [],
    whatYouGet: Array.isArray(raw?.whatYouGet) ? raw.whatYouGet.map((item: any) => ({ text: item?.text || '' })) : [],
    graphic: raw?.graphic || null,
  }
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--theme-border-color)',
  borderRadius: 8,
  background: 'var(--theme-input-bg)',
  color: 'var(--theme-text)',
  fontSize: 13,
  padding: '9px 11px',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 5,
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--theme-elevation-550)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'block', minWidth: 0 }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </div>
  )
}

function SmallButton({
  children,
  onClick,
  disabled,
  tone = 'default',
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'primary' | 'danger'
}) {
  const color = tone === 'primary' ? '#ffcc00' : tone === 'danger' ? '#ef4444' : 'var(--theme-elevation-550)'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: `1px solid ${tone === 'default' ? 'var(--theme-border-color)' : `${color}80`}`,
        borderRadius: 8,
        background: tone === 'default' ? 'var(--theme-elevation-50)' : `${color}16`,
        color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        fontSize: 12,
        fontWeight: 700,
        padding: '8px 10px',
      }}
    >
      {children}
    </button>
  )
}

function ImagePicker({
  media,
  value,
  onChange,
}: {
  media: MediaOption[]
  value: string | number | null
  onChange: (selected: MediaOption | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = media.find((item) => String(item.id) === String(value)) || null

  useEffect(() => {
    if (!open) return
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: '100%',
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 10px',
          border: `1px solid ${open ? '#ffcc00' : 'var(--theme-border-color)'}`,
          borderRadius: 8,
          background: 'var(--theme-input-bg)',
          color: 'var(--theme-text)',
          cursor: 'pointer',
          textAlign: 'left',
          minHeight: 42,
        }}
      >
        {selected?.url ? (
          <img src={selected.url} alt={selected.alt} style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, flexShrink: 0, border: '1px solid var(--theme-border-color)' }} />
        ) : (
          <div style={{ width: 32, height: 32, borderRadius: 4, background: 'var(--theme-elevation-100)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🖼️</div>
        )}
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.filename : 'No graphic'}
        </span>
        <span style={{ fontSize: 10, color: 'var(--theme-elevation-550)', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          right: 0,
          zIndex: 100,
          background: 'var(--theme-elevation-0)',
          border: '1px solid var(--theme-border-color)',
          borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          padding: 10,
          maxHeight: 320,
          overflowY: 'auto',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false) }}
              style={{
                border: `2px solid ${!selected ? '#ffcc00' : 'var(--theme-border-color)'}`,
                borderRadius: 8,
                background: !selected ? 'rgba(255,204,0,0.1)' : 'var(--theme-elevation-50)',
                cursor: 'pointer',
                padding: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 5,
                color: 'var(--theme-elevation-550)',
                fontSize: 11,
              }}
            >
              <div style={{ width: '100%', aspectRatio: '16/9', background: 'var(--theme-elevation-100)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✕</div>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>None</span>
            </button>
            {media.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { onChange(item); setOpen(false) }}
                style={{
                  border: `2px solid ${String(item.id) === String(value) ? '#ffcc00' : 'var(--theme-border-color)'}`,
                  borderRadius: 8,
                  background: String(item.id) === String(value) ? 'rgba(255,204,0,0.1)' : 'var(--theme-elevation-50)',
                  cursor: 'pointer',
                  padding: 0,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                }}
                title={item.filename}
              >
                {item.url ? (
                  <img src={item.url} alt={item.alt} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', aspectRatio: '16/9', background: 'var(--theme-elevation-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🖼️</div>
                )}
                <div style={{ padding: '5px 7px', fontSize: 10, color: 'var(--theme-elevation-550)', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.filename}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TrackPreview({ track }: { track: Track }) {
  const visibleChallenges = track.challenges.filter((challenge) => challenge.title || challenge.desc)
  const activeChallenge = visibleChallenges[0] || { title: 'Challenge type', desc: 'Add challenge copy to preview this card.' }
  const graphicUrl = track.graphic && typeof track.graphic === 'object' ? track.graphic.url : null

  return (
    <div style={{
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 16,
      background: 'linear-gradient(180deg, #203e5f, #0c0c0e)',
      color: 'white',
      boxShadow: '0 28px 80px -48px rgba(0,0,0,0.9)',
    }}>
      <div style={{ height: 4, background: `linear-gradient(90deg, ${track.color || '#ffcc00'}, transparent)` }} />
      <div style={{ display: 'grid', gridTemplateColumns: graphicUrl ? '1fr 220px' : '1fr', gap: 22, padding: 22 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <span style={{
              maxWidth: '80%',
              borderRadius: 999,
              background: `${track.color || '#ffcc00'}20`,
              color: track.color || '#ffcc00',
              fontSize: 9,
              fontWeight: 800,
              padding: '3px 8px',
              textTransform: 'uppercase',
            }}>
              {track.badge || 'Badge'}
            </span>
            <span style={{ fontSize: 24 }}>{track.icon || '🚀'}</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{track.name || 'Track name'}</div>
          <div style={{ marginTop: 4, color: 'rgba(255,255,255,0.62)', fontSize: 13, fontStyle: 'italic' }}>
            {track.tagline || 'Track tagline'}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: 14, lineHeight: 1.7, marginTop: 18 }}>
            {track.desc || 'Track description appears here.'}
          </p>
        </div>
        {graphicUrl && (
          <div style={{
            border: `1px solid ${track.color || '#ffcc00'}66`,
            borderRadius: 12,
            overflow: 'hidden',
            alignSelf: 'start',
            boxShadow: `0 0 58px -24px ${track.color || '#ffcc00'}`,
          }}>
            <img src={graphicUrl} alt="" style={{ display: 'block', width: '100%', height: 'auto' }} />
          </div>
        )}
      </div>
      <div style={{ height: 1, margin: '0 24px', background: 'rgba(255,255,255,0.08)' }} />
      <div style={{ padding: 22 }}>
        <div style={{ marginBottom: 10, color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: 800, letterSpacing: '0.24em', textTransform: 'uppercase' }}>
          Challenge type
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
          {visibleChallenges.map((challenge, index) => (
            <span
              key={`${challenge.key}-${index}`}
              style={{
                border: `1px solid ${index === 0 ? track.color || '#ffcc00' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 999,
                background: index === 0 ? `${track.color || '#ffcc00'}18` : 'transparent',
                color: index === 0 ? track.color || '#ffcc00' : 'rgba(255,255,255,0.68)',
                fontSize: 12,
                fontWeight: 700,
                padding: '6px 10px',
              }}
            >
              {challenge.title}
            </span>
          ))}
        </div>
        <div style={{
          border: '1px solid rgba(255,255,255,0.08)',
          borderLeft: `4px solid ${track.color || '#ffcc00'}`,
          borderRadius: 12,
          background: 'rgba(255,255,255,0.04)',
          color: 'rgba(255,255,255,0.78)',
          fontSize: 14,
          lineHeight: 1.65,
          minHeight: 82,
          padding: 15,
        }}>
          <strong style={{ color: 'white' }}>{activeChallenge.title} — </strong>
          {activeChallenge.desc}
        </div>
      </div>
    </div>
  )
}

export default function TrackCarouselEditor() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [partners, setPartners] = useState<PartnerOption[]>([])
  const [media, setMedia] = useState<MediaOption[]>([])
  const [trackOptions, setTrackOptions] = useState<TrackOption[]>([])

  const activeTrack = tracks[activeIndex] || null

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [settingsRes, partnersRes, mediaRes, tracksRes] = await Promise.all([
        fetch('/api/globals/platform-settings?depth=1'),
        fetch('/api/partners?limit=100&depth=1&sort=name'),
        fetch('/api/media?limit=100&depth=0&sort=-createdAt'),
        fetch('/api/tracks?limit=100&depth=0&sort=name'),
      ])
      if (!settingsRes.ok) throw new Error(`Platform settings load failed (${settingsRes.status})`)
      const settings = await settingsRes.json()
      const partnerData = partnersRes.ok ? await partnersRes.json() : { docs: [] }
      const mediaData = mediaRes.ok ? await mediaRes.json() : { docs: [] }
      const tracksData = tracksRes.ok ? await tracksRes.json() : { docs: [] }

      setTracks(Array.isArray(settings.tracks) ? settings.tracks.map(normalizeTrack) : [])
      setPartners((partnerData.docs || []).map((partner: any) => ({
        id: partner.id,
        name: partner.name || `Partner ${partner.id}`,
        logoUrl: partner.logo && typeof partner.logo === 'object' ? partner.logo.url ?? null : null,
      })))
      setMedia((mediaData.docs || []).map((item: any) => ({
        id: item.id,
        filename: item.filename || item.alt || `Media ${item.id}`,
        url: item.url || null,
        alt: item.alt || item.filename || '',
      })))
      setTrackOptions((tracksData.docs || []).map((track: any) => ({
        id: track.id,
        name: track.name || `Track ${track.id}`,
        slug: String(track.slug || '').trim().toLowerCase(),
        isActive: track.isActive !== false,
      })))
      setActiveIndex(0)
      setDirty(false)
    } catch (e: any) {
      setError(e.message || 'Failed to load track carousel data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const updateTrack = (patch: Partial<Track>) => {
    setTracks((current) => current.map((track, index) => index === activeIndex ? { ...track, ...patch } : track))
    setDirty(true)
  }

  const updateChallenge = (index: number, patch: Partial<Challenge>) => {
    if (!activeTrack) return
    updateTrack({
      challenges: activeTrack.challenges.map((challenge, challengeIndex) => (
        challengeIndex === index ? { ...challenge, ...patch } : challenge
      )),
    })
  }

  const selectedPartnerIds = useMemo(() => new Set((activeTrack?.partners || []).map(relationId).filter(Boolean)), [activeTrack])
  const selectedGraphicId = relationId(activeTrack?.graphic)
  const selectedTrackId = relationId(activeTrack?.startTrack)

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        challengePills: CHALLENGE_PILLS,
        tracks: tracks.map((track) => ({
          key: track.key.trim(),
          icon: track.icon,
          name: track.name,
          enabled: track.enabled,
          badge: track.badge,
          tagline: track.tagline,
          desc: track.desc,
          color: track.color,
          applyUrl: track.applyUrl,
          applyButtonText: track.applyButtonText,
          startTrack: relationId(track.startTrack),
          partners: track.partners.map(relationId).filter(Boolean),
          challenges: track.challenges
            .filter((challenge) => challenge.key && (challenge.title.trim() || challenge.desc.trim()))
            .map((challenge) => ({
              key: challenge.key,
              title: challenge.title,
              desc: challenge.desc,
            })),
          whatYouGet: track.whatYouGet.filter((item) => item.text.trim()).map((item) => ({ text: item.text })),
          graphic: relationId(track.graphic),
        })),
      }
      const res = await fetch('/api/globals/platform-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.errors?.[0]?.message || `Save failed (${res.status})`)
      }
      setDirty(false)
      setSavedAt(new Date().toLocaleTimeString())
      await loadData()
    } catch (e: any) {
      setError(e.message || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: 320, display: 'grid', placeItems: 'center', color: 'var(--theme-elevation-550)' }}>
        Loading track carousel editor…
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 var(--base) calc(var(--base) * 3)' }}>
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '14px 0',
        background: 'var(--theme-bg)',
        borderBottom: '1px solid var(--theme-border-color)',
      }}>
        <div>
          <Link href="/admin/globals/platform-settings" style={{ color: 'var(--theme-elevation-650)', fontSize: 13, textDecoration: 'none' }}>← Platform Settings</Link>
          <h2 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: 'var(--theme-text)' }}>Track Carousel Editor</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {dirty && <span style={{ color: 'var(--theme-warning-600)', fontSize: 12, fontWeight: 700 }}>Unsaved changes</span>}
          {savedAt && !dirty && <span style={{ color: 'var(--theme-success-600)', fontSize: 12, fontWeight: 700 }}>Saved at {savedAt}</span>}
          <SmallButton onClick={() => void loadData()}>Reload current data</SmallButton>
          <SmallButton tone="primary" onClick={() => void save()} disabled={saving || tracks.length === 0}>{saving ? 'Saving…' : 'Save carousel'}</SmallButton>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 16, border: '1px solid #ef444466', background: '#ef444414', color: '#ef4444', borderRadius: 10, padding: 12, fontWeight: 700 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: 18, marginTop: 18 }}>
        <aside style={{ border: '1px solid var(--theme-border-color)', borderRadius: 14, background: 'var(--theme-elevation-50)', padding: 12, alignSelf: 'start' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <strong style={{ color: 'var(--theme-text)' }}>Tracks</strong>
            <SmallButton tone="primary" onClick={() => { setTracks((current) => [...current, blankTrack()]); setActiveIndex(tracks.length); setDirty(true) }}>+ Add</SmallButton>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {tracks.map((track, index) => (
              <button
                type="button"
                key={`${track.key}-${index}`}
                onClick={() => setActiveIndex(index)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  border: `1px solid ${index === activeIndex ? track.color || '#ffcc00' : 'var(--theme-border-color)'}`,
                  borderRadius: 12,
                  background: index === activeIndex ? `${track.color || '#ffcc00'}14` : 'var(--theme-elevation-0)',
                  color: 'var(--theme-text)',
                  cursor: 'pointer',
                  padding: 12,
                  opacity: track.enabled ? 1 : 0.6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{track.icon}</span>
                  <span style={{ color: track.color || '#ffcc00', fontSize: 11, fontWeight: 800 }}>{track.challenges.length} types</span>
                </div>
                <div style={{ marginTop: 5, fontWeight: 800 }}>{track.name || 'Unnamed track'}</div>
                <div style={{ marginTop: 3, color: 'var(--theme-elevation-550)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{track.badge || 'No badge'}</span>
                  {!track.enabled && (
                    <span style={{ border: '1px solid #ef444466', borderRadius: 999, padding: '1px 6px', fontSize: 10, color: '#ef4444', fontWeight: 700 }}>
                      Disabled
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </aside>

        {activeTrack && (
          <main style={{ display: 'grid', gap: 18 }}>
            <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(360px, 0.9fr)', gap: 18 }}>
              <div style={{ border: '1px solid var(--theme-border-color)', borderRadius: 14, background: 'var(--theme-elevation-50)', padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                  <h3 style={{ margin: 0, color: 'var(--theme-text)' }}>Edit selected track</h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <SmallButton
                      onClick={() => updateTrack({ enabled: !activeTrack.enabled })}
                      tone={activeTrack.enabled ? 'default' : 'danger'}
                    >
                      {activeTrack.enabled ? 'Disable' : 'Enable'}
                    </SmallButton>
                    <SmallButton onClick={() => { if (activeIndex <= 0) return; const next = [...tracks]; [next[activeIndex - 1], next[activeIndex]] = [next[activeIndex], next[activeIndex - 1]]; setTracks(next); setActiveIndex(activeIndex - 1); setDirty(true) }} disabled={activeIndex === 0}>↑</SmallButton>
                    <SmallButton onClick={() => { if (activeIndex >= tracks.length - 1) return; const next = [...tracks]; [next[activeIndex + 1], next[activeIndex]] = [next[activeIndex], next[activeIndex + 1]]; setTracks(next); setActiveIndex(activeIndex + 1); setDirty(true) }} disabled={activeIndex >= tracks.length - 1}>↓</SmallButton>
                    <SmallButton tone="danger" onClick={() => { const next = tracks.filter((_, index) => index !== activeIndex); setTracks(next); setActiveIndex(Math.max(0, activeIndex - 1)); setDirty(true) }} disabled={tracks.length <= 1}>Delete</SmallButton>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px', gap: 10 }}>
                  <Field label="Name"><input style={inputStyle} value={activeTrack.name} onChange={(e) => updateTrack({ name: e.target.value })} /></Field>
                  <Field label="Icon"><input style={inputStyle} value={activeTrack.icon} onChange={(e) => updateTrack({ icon: e.target.value })} /></Field>
                  <Field label="Color"><input style={{ ...inputStyle, padding: 4, height: 38 }} type="color" value={activeTrack.color || '#ffcc00'} onChange={(e) => updateTrack({ color: e.target.value })} /></Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                  <Field label="Internal key"><input style={inputStyle} value={activeTrack.key} onChange={(e) => updateTrack({ key: e.target.value.trim().toLowerCase() })} /></Field>
                  <Field label="Badge"><input style={inputStyle} value={activeTrack.badge} onChange={(e) => updateTrack({ badge: e.target.value })} /></Field>
                </div>
                <div style={{ marginTop: 10 }}>
                  <Field label="Tagline"><input style={inputStyle} value={activeTrack.tagline} onChange={(e) => updateTrack({ tagline: e.target.value })} /></Field>
                </div>
                <div style={{ marginTop: 10 }}>
                  <Field label="Description"><textarea style={{ ...inputStyle, minHeight: 92, resize: 'vertical' }} value={activeTrack.desc} onChange={(e) => updateTrack({ desc: e.target.value })} /></Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                  <Field label="Apply URL"><input style={inputStyle} value={activeTrack.applyUrl} onChange={(e) => updateTrack({ applyUrl: e.target.value })} /></Field>
                  <Field label="Apply button"><input style={inputStyle} value={activeTrack.applyButtonText} onChange={(e) => updateTrack({ applyButtonText: e.target.value })} /></Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px', gap: 10, marginTop: 10 }}>
                  <Field label="Track assigned on Start button">
                    <select
                      style={inputStyle}
                      value={selectedTrackId != null ? String(selectedTrackId) : ''}
                      onChange={(e) => {
                        const nextId = e.target.value
                        const selected = trackOptions.find((option) => String(option.id) === nextId)
                        updateTrack({
                          startTrack: selected
                            ? { id: selected.id, slug: selected.slug, name: selected.name }
                            : null,
                        })
                      }}
                    >
                      <option value="">Use carousel key ({activeTrack.key || 'not set'})</option>
                      {trackOptions.map((option) => (
                        <option key={option.id} value={option.id} disabled={!option.isActive}>
                          {option.name} ({option.slug || `id:${option.id}`}){option.isActive ? '' : ' [inactive]'}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Visible on landing">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 38, border: '1px solid var(--theme-border-color)', borderRadius: 8, padding: '0 11px', background: 'var(--theme-input-bg)', color: 'var(--theme-text)' }}>
                      <input
                        type="checkbox"
                        checked={activeTrack.enabled}
                        onChange={(e) => updateTrack({ enabled: e.target.checked })}
                      />
                      <span style={{ fontSize: 13 }}>{activeTrack.enabled ? 'Enabled' : 'Disabled'}</span>
                    </label>
                  </Field>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10, marginTop: 14 }}>
                  <Field label="Graphic">
                    <ImagePicker
                      media={media}
                      value={selectedGraphicId}
                      onChange={(selected) => updateTrack({ graphic: selected ? { id: selected.id, url: selected.url, filename: selected.filename, alt: selected.alt } : null })}
                    />
                  </Field>
                  <Field label="Partners">
                    <select
                      style={inputStyle}
                      value=""
                      onChange={(e) => {
                        const selected = partners.find((partner) => String(partner.id) === e.target.value)
                        if (!selected || selectedPartnerIds.has(selected.id)) return
                        updateTrack({ partners: [...activeTrack.partners, selected] })
                      }}
                    >
                      <option value="">Add partner…</option>
                      {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
                    </select>
                  </Field>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
                  {activeTrack.partners.map((partner) => (
                    <span key={String(relationId(partner))} style={{ border: '1px solid var(--theme-border-color)', borderRadius: 999, padding: '5px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', maxWidth: '100%', gap: 4 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                        {partner.name || `Partner ${relationId(partner)}`}
                      </span>
                      <button type="button" onClick={() => updateTrack({ partners: activeTrack.partners.filter((item) => relationId(item) !== relationId(partner)) })} style={{ marginLeft: 6, border: 0, background: 'transparent', color: '#ef4444', cursor: 'pointer' }}>×</button>
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ border: '1px solid var(--theme-border-color)', borderRadius: 14, background: 'var(--theme-elevation-50)', padding: 16 }}>
                <h3 style={{ margin: '0 0 12px', color: 'var(--theme-text)' }}>Live carousel card preview</h3>
                <TrackPreview track={activeTrack} />
              </div>
            </section>

            <section style={{ border: '1px solid var(--theme-border-color)', borderRadius: 14, background: 'var(--theme-elevation-50)', padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                <h3 style={{ margin: 0, color: 'var(--theme-text)' }}>Challenge types</h3>
                <SmallButton onClick={() => {
                  const preset = TRACK_PRESETS[activeTrack.key] || ['general']
                  updateTrack({ challenges: preset.map((key) => ({ key, title: CHALLENGE_PILLS.find((pill) => pill.key === key)?.label || key, desc: activeTrack.challenges.find((challenge) => challenge.key === key)?.desc || '' })) })
                }}>Apply preset for this track</SmallButton>
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                {activeTrack.challenges.map((challenge, index) => (
                  <div key={`${challenge.key}-${index}`} style={{ display: 'grid', gridTemplateColumns: '180px 220px 1fr auto', gap: 10, alignItems: 'start' }}>
                    <select style={inputStyle} value={challenge.key} onChange={(e) => {
                      const label = CHALLENGE_PILLS.find((pill) => pill.key === e.target.value)?.label || e.target.value
                      updateChallenge(index, { key: e.target.value, title: label })
                    }}>
                      {CHALLENGE_PILLS.map((pill) => <option key={pill.key} value={pill.key}>{pill.label}</option>)}
                    </select>
                    <input style={inputStyle} value={challenge.title} onChange={(e) => updateChallenge(index, { title: e.target.value })} />
                    <textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} value={challenge.desc} onChange={(e) => updateChallenge(index, { desc: e.target.value })} />
                    <SmallButton tone="danger" onClick={() => updateTrack({ challenges: activeTrack.challenges.filter((_, challengeIndex) => challengeIndex !== index) })}>Remove</SmallButton>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12 }}>
                <SmallButton tone="primary" onClick={() => updateTrack({ challenges: [...activeTrack.challenges, { key: 'general', title: 'General', desc: '' }] })}>+ Add challenge type</SmallButton>
              </div>
            </section>

            <section style={{ border: '1px solid var(--theme-border-color)', borderRadius: 14, background: 'var(--theme-elevation-50)', padding: 16 }}>
              <h3 style={{ margin: '0 0 12px', color: 'var(--theme-text)' }}>What founders get</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {activeTrack.whatYouGet.map((item, index) => (
                  <div key={`${item.text}-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                    <input style={inputStyle} value={item.text} onChange={(e) => updateTrack({ whatYouGet: activeTrack.whatYouGet.map((row, rowIndex) => rowIndex === index ? { text: e.target.value } : row) })} />
                    <SmallButton tone="danger" onClick={() => updateTrack({ whatYouGet: activeTrack.whatYouGet.filter((_, rowIndex) => rowIndex !== index) })}>Remove</SmallButton>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10 }}>
                <SmallButton tone="primary" onClick={() => updateTrack({ whatYouGet: [...activeTrack.whatYouGet, { text: '' }] })}>+ Add item</SmallButton>
              </div>
            </section>
          </main>
        )}
      </div>
    </div>
  )
}
