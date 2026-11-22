'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'
import { CANONICAL_ARCHETYPES } from '@/lib/curriculum/constants'

type FormOption = { id: number; title: string; slug: string }
type PartnerOption = { id: number; name: string }
type TrackOption = { id: number; slug: string; name: string; isActive: boolean }
type Schedule = Record<string, number | null>

type ScheduleContext = 'global' | 'archetype' | 'partner' | 'track'

const PHASES = [
    { name: 'MIX', startDay: 1, endDay: 21, color: '#3b82f6' },
    { name: 'PROOF', startDay: 22, endDay: 49, color: '#8b5cf6' },
    { name: 'BAKE', startDay: 50, endDay: 77, color: '#f59e0b' },
    { name: 'GLAZE', startDay: 78, endDay: 100, color: '#10b981' },
]

const ARCHETYPE_OPTIONS = CANONICAL_ARCHETYPES.map((archetype) => ({
    label: `${archetype.emoji} ${archetype.key}`,
    value: archetype.key,
}))

const ARCHETYPE_EMOJIS: Record<string, string> = Object.fromEntries(
    ARCHETYPE_OPTIONS.map(o => [o.value, o.label.split(' ')[0]])
)

const inputStyle: React.CSSProperties = {
    padding: '7px 10px',
    background: 'var(--theme-input-bg)',
    border: '1px solid var(--theme-border-color)',
    borderRadius: 4,
    fontSize: 13,
    color: 'var(--theme-text)',
    outline: 'none',
}

function chunkDays(startDay: number, endDay: number): number[][] {
    const days = Array.from({ length: endDay - startDay + 1 }, (_, i) => i + startDay)
    const rows: number[][] = []
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7))
    return rows
}

function countAssigned(schedule: Schedule, start: number, end: number): number {
    let count = 0
    for (let d = start; d <= end; d++) {
        if (schedule[String(d)] != null) count++
    }
    return count
}

function DayCell({
    day, formId, forms, isActive, onActivate, onSelect, label,
}: {
    day: number
    formId: number | null
    forms: FormOption[]
    isActive: boolean
    onActivate: () => void
    onSelect: (id: number | null) => void
    label?: string
}) {
    const form = forms.find(f => f.id === formId) ?? null
    const title = form
        ? (form.title.length > 14 ? form.title.slice(0, 13) + '…' : form.title)
        : '—'
    const cellLabel = label || `Day ${day}`

    return (
        <div style={{ position: 'relative' }}>
            <div
                onClick={onActivate}
                style={{
                    border: `1px solid ${isActive ? 'var(--theme-success-500)' : formId ? 'var(--theme-border-color)' : 'var(--theme-elevation-150)'}`,
                    borderRadius: 6,
                    padding: '5px 7px',
                    cursor: 'pointer',
                    width: 90,
                    background: formId ? 'var(--theme-elevation-50)' : 'transparent',
                    transition: 'border-color 0.15s',
                    userSelect: 'none',
                }}
            >
                <div style={{ fontSize: 9, color: 'var(--theme-elevation-400)', marginBottom: 2, fontWeight: 600 }}>
                    {cellLabel}
                </div>
                <div style={{
                    fontSize: 11,
                    fontWeight: formId ? 600 : 400,
                    color: formId ? 'var(--theme-text)' : 'var(--theme-elevation-300)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                }}>
                    {title}
                </div>
            </div>
            {isActive && (
                <div style={{
                    position: 'absolute',
                    top: '100%', left: 0, zIndex: 100,
                    background: 'var(--theme-elevation-0)',
                    border: '1px solid var(--theme-border-color)',
                    borderRadius: 6, padding: 6, minWidth: 220,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)', marginTop: 2,
                }}>
                    <div style={{ fontSize: 10, color: 'var(--theme-elevation-450)', marginBottom: 4, fontWeight: 600 }}>
                        {cellLabel} — assign form
                    </div>
                    <select
                        autoFocus
                        value={formId ?? ''}
                        onChange={e => {
                            const val = e.target.value
                            onSelect(val === '' ? null : parseInt(val, 10))
                        }}
                        onBlur={() => onActivate()}
                        style={{ ...inputStyle, width: '100%', fontSize: 12 }}
                    >
                        <option value="">— No form —</option>
                        {forms.map(f => (
                            <option key={f.id} value={f.id}>{f.title}</option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    )
}

export default function DayProgramEditor() {
    // Use Payload's hook for reliable context detection
    const { id, collectionSlug, globalSlug } = useDocumentInfo()

    const context: ScheduleContext = globalSlug === 'day-program'
        ? 'global'
        : collectionSlug === 'archetype-day-schedules'
            ? 'archetype'
            : collectionSlug === 'partner-day-schedules'
                ? 'partner'
                : 'track'

    const isGlobal = context === 'global'
    const apiSlug = isGlobal ? '' : collectionSlug!
    const recordId = id ? String(id) : null
    const isCreateMode = !recordId

    const [scheduleMode, setScheduleMode] = useState<string>('default')
    const [dailyReleaseTime, setDailyReleaseTime] = useState<string>('12:00')
    const [schedule, setSchedule] = useState<Schedule>({})
    const [preworkSchedule, setPreworkSchedule] = useState<Schedule>({})
    const [archetype, setArchetype] = useState<string>('')
    const [partnerId, setPartnerId] = useState<number | null>(null)
    const [trackSlug, setTrackSlug] = useState<string>('')
    const [partnerOptions, setPartnerOptions] = useState<PartnerOption[]>([])
    const [trackOptions, setTrackOptions] = useState<TrackOption[]>([])
    const [forms, setForms] = useState<FormOption[]>([])

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [savedAt, setSavedAt] = useState<string | null>(null)
    const [dirty, setDirty] = useState(false)
    const [activeDay, setActiveDay] = useState<number | null>(null)
    const initialRef = useRef<string>('')

    const [totalPreworkBlocks, setTotalPreworkBlocks] = useState<number>(10)

    const buildSnapshot = () => {
        if (isGlobal) return JSON.stringify({ mode: scheduleMode, releaseTime: dailyReleaseTime, schedule, preworkSchedule })
        if (context === 'archetype') return JSON.stringify({ archetype, schedule, preworkSchedule })
        if (context === 'partner') return JSON.stringify({ partner: partnerId, schedule, preworkSchedule })
        return JSON.stringify({ trackSlug, schedule, preworkSchedule })
    }

    useEffect(() => {
        const formsPromise = fetch('/api/founder-forms?limit=200&depth=0&sort=title')
            .then(r => r.json())
            .catch(() => ({ docs: [] }))

        const dataPromise = isGlobal
            ? fetch('/api/globals/day-program?depth=0').then(r => r.json()).catch(() => null)
            : recordId
                ? fetch(`/api/${apiSlug}/${recordId}?depth=0`).then(r => r.json()).catch(() => null)
                : Promise.resolve(null)

        // Fetch partner options if needed
        const partnersPromise = context === 'partner'
            ? fetch('/api/partners?limit=100&depth=0&sort=name').then(r => r.json()).catch(() => ({ docs: [] }))
            : Promise.resolve(null)

        // Fetch track options if needed
        const tracksPromise = context === 'track'
            ? fetch('/api/tracks?limit=100&depth=0&sort=name').then(r => r.json()).catch(() => ({ docs: [] }))
            : Promise.resolve(null)

        // Fetch global config for totalPreworkBlocks (needed by all contexts)
        const globalConfigPromise = !isGlobal
            ? fetch('/api/globals/day-program?depth=0').then(r => r.json()).catch(() => null)
            : Promise.resolve(null)

        Promise.all([formsPromise, dataPromise, partnersPromise, tracksPromise, globalConfigPromise])
            .then(([formsData, data, partnersData, tracksData, globalConfig]) => {
                setForms(formsData?.docs ?? [])
                if (partnersData) setPartnerOptions(partnersData.docs ?? [])
                if (tracksData) setTrackOptions(tracksData.docs ?? [])
                if (globalConfig) setTotalPreworkBlocks(globalConfig.totalPreworkBlocks ?? 10)

                if (isGlobal && data) {
                    const mode = data.scheduleMode ?? 'default'
                    const sched = data.defaultSchedule ?? {}
                    const pwSched = data.preworkSchedule ?? {}
                    const releaseTime = data.dailyReleaseTime ?? '12:00'
                    setScheduleMode(mode)
                    setDailyReleaseTime(releaseTime)
                    setSchedule(sched)
                    setPreworkSchedule(pwSched)
                    setTotalPreworkBlocks(data.totalPreworkBlocks ?? 10)
                    initialRef.current = JSON.stringify({ mode, releaseTime, schedule: sched, preworkSchedule: pwSched })
                } else if (data) {
                    const sched = data.schedule ?? {}
                    const pwSched = data.preworkSchedule ?? {}
                    setSchedule(sched)
                    setPreworkSchedule(pwSched)
                    if (context === 'archetype') {
                        setArchetype(data.archetype ?? '')
                        initialRef.current = JSON.stringify({ archetype: data.archetype ?? '', schedule: sched, preworkSchedule: pwSched })
                    } else if (context === 'partner') {
                        const pid = typeof data.partner === 'object' ? data.partner?.id : data.partner
                        setPartnerId(pid ?? null)
                        initialRef.current = JSON.stringify({ partner: pid ?? null, schedule: sched, preworkSchedule: pwSched })
                    } else {
                        setTrackSlug(data.trackSlug ?? '')
                        initialRef.current = JSON.stringify({ trackSlug: data.trackSlug ?? '', schedule: sched, preworkSchedule: pwSched })
                    }
                } else {
                    // Create mode
                    const empty = { schedule: {}, preworkSchedule: {} }
                    if (isGlobal) {
                        initialRef.current = JSON.stringify({ mode: 'default', releaseTime: '12:00', ...empty })
                    } else if (context === 'archetype') {
                        initialRef.current = JSON.stringify({ archetype: '', ...empty })
                    } else if (context === 'partner') {
                        initialRef.current = JSON.stringify({ partner: null, ...empty })
                    } else {
                        initialRef.current = JSON.stringify({ trackSlug: '', ...empty })
                    }
                }
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false))
    }, [isGlobal, recordId, apiSlug, context])  

    useEffect(() => {
        if (loading) return
        setDirty(buildSnapshot() !== initialRef.current)
    }, [schedule, preworkSchedule, scheduleMode, dailyReleaseTime, archetype, partnerId, trackSlug, loading, context]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleSave = async () => {
        if (context === 'archetype' && !archetype) {
            setError('Please select an archetype before saving.')
            return
        }
        if (context === 'partner' && !partnerId) {
            setError('Please select a partner before saving.')
            return
        }
        if (context === 'track' && !trackSlug) {
            setError('Please select a track before saving.')
            return
        }
        setSaving(true)
        setError(null)
        try {
            if (isGlobal) {
                const res = await fetch('/api/globals/day-program', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ scheduleMode, dailyReleaseTime, defaultSchedule: schedule, preworkSchedule }),
                })
                if (!res.ok) throw new Error(`Save failed (${res.status})`)
            } else {
                const body = context === 'archetype'
                    ? { archetype, schedule, preworkSchedule }
                    : context === 'partner'
                        ? { partner: partnerId, schedule, preworkSchedule }
                        : { trackSlug, schedule, preworkSchedule }

                if (isCreateMode) {
                    const res = await fetch(`/api/${apiSlug}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                    })
                    if (!res.ok) throw new Error(`Save failed (${res.status})`)
                    const created = await res.json()
                    if (created?.doc?.id) {
                        window.location.href = `/admin/collections/${apiSlug}/${created.doc.id}`
                        return
                    }
                } else {
                    const res = await fetch(`/api/${apiSlug}/${recordId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                    })
                    if (!res.ok) throw new Error(`Save failed (${res.status})`)
                }
            }
            initialRef.current = buildSnapshot()
            setDirty(false)
            setSavedAt(new Date().toLocaleTimeString())
        } catch (e: any) {
            setError(e.message)
        } finally {
            setSaving(false)
        }
    }

    const totalAssigned = Object.values(schedule).filter(v => v != null).length
    const archetypeEmoji = archetype ? (ARCHETYPE_EMOJIS[archetype] ?? '') : ''
    const selectedPartner = partnerOptions.find(p => p.id === partnerId)
    const selectedTrack = trackOptions.find(t => t.slug === trackSlug)

    const backLink = isGlobal ? '/admin/globals/day-program'
        : `/admin/collections/${apiSlug}`
    const backLabel = isGlobal ? 'Day Program'
        : context === 'archetype' ? 'Archetype Schedules'
        : context === 'partner' ? 'Partner Schedules'
        : 'Track Schedules'
    const pageTitle = isGlobal ? '📅 Default 100-Day Schedule'
        : context === 'archetype'
            ? archetype ? `${archetypeEmoji} ${archetype} — 100-Day Schedule` : '📅 New Archetype Schedule'
        : context === 'partner'
            ? selectedPartner ? `🤝 ${selectedPartner.name} — 100-Day Schedule` : '🤝 New Partner Schedule'
        : selectedTrack ? `🛤️ ${selectedTrack.name || trackSlug} — 100-Day Schedule` : '🛤️ New Track Schedule'

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, color: 'var(--theme-elevation-500)' }}>
                <div style={{ width: 28, height: 28, border: '3px solid var(--theme-elevation-250)', borderTopColor: 'var(--theme-success-500)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Loading…
            </div>
        )
    }

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 var(--base) calc(var(--base) * 3)' }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            {/* Sticky header */}
            <div style={{
                position: 'sticky', top: 0, zIndex: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 0', marginBottom: 16,
                background: 'var(--theme-bg)',
                borderBottom: '1px solid var(--theme-border-color)',
                gap: 12, flexWrap: 'wrap',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <a
                        href={backLink}
                        style={{ color: 'var(--theme-elevation-650)', textDecoration: 'none', fontSize: 13 }}
                    >
                        ← {backLabel}
                    </a>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--theme-text)' }}>
                        {pageTitle}
                    </h2>
                    {dirty && (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 3, background: 'var(--theme-warning-100)', color: 'var(--theme-warning-600)', fontWeight: 600 }}>
                            Unsaved changes
                        </span>
                    )}
                    {savedAt && !dirty && (
                        <span style={{ fontSize: 11, color: 'var(--theme-success-600)', fontWeight: 500 }}>
                            ✓ Saved at {savedAt}
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--theme-elevation-450)' }}>
                        {totalAssigned} / 100 days · {countAssigned(preworkSchedule, 1, totalPreworkBlocks)} / {totalPreworkBlocks} PW assigned
                    </span>

                    {isGlobal && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-elevation-600)', whiteSpace: 'nowrap' }}>
                                    Release Time (CET):
                                </label>
                                <input
                                    type="time"
                                    value={dailyReleaseTime}
                                    onChange={e => setDailyReleaseTime(e.target.value)}
                                    style={{ ...inputStyle, fontSize: 12, padding: '4px 8px' }}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-elevation-600)', whiteSpace: 'nowrap' }}>
                                    Schedule Mode:
                                </label>
                                <select
                                    value={scheduleMode}
                                    onChange={e => setScheduleMode(e.target.value)}
                                    style={{ ...inputStyle, fontSize: 12, padding: '5px 8px' }}
                                >
                                    <option value="default">Default Only</option>
                                    <option value="archetype">Archetype Only</option>
                                    <option value="archetype-with-fallback">Archetype + Default Fallback</option>
                                </select>
                            </div>
                        </>
                    )}

                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || !dirty}
                        style={{
                            padding: '8px 20px', borderRadius: 4, fontSize: 13, fontWeight: 700,
                            border: 'none', cursor: saving || !dirty ? 'default' : 'pointer',
                            background: saving || !dirty ? 'var(--theme-elevation-200)' : 'var(--theme-success-500)',
                            color: saving || !dirty ? 'var(--theme-elevation-500)' : '#fff',
                            transition: 'all 0.15s',
                        }}
                    >
                        {saving ? 'Saving…' : dirty ? '💾 Save' : 'Saved'}
                    </button>
                </div>
            </div>

            {error && (
                <div style={{
                    marginBottom: 16, padding: '12px 16px',
                    background: 'var(--theme-error-100)', border: '1px solid var(--theme-error-300)',
                    borderRadius: 6, color: 'var(--theme-error-500)', fontSize: 13,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    ⚠️ {error}
                    <button
                        type="button"
                        onClick={() => setError(null)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-error-500)', fontSize: 16 }}
                    >✕</button>
                </div>
            )}

            {/* Context-specific selector */}
            {context === 'archetype' && (
                <div style={{
                    marginBottom: 20, padding: '14px 16px',
                    background: 'var(--theme-elevation-100)',
                    border: '1px solid var(--theme-border-color)',
                    borderRadius: 6,
                    display: 'flex', alignItems: 'center', gap: 12,
                }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--theme-elevation-600)', whiteSpace: 'nowrap' }}>
                        Archetype:
                    </label>
                    <select
                        value={archetype}
                        onChange={e => setArchetype(e.target.value)}
                        style={{ ...inputStyle, minWidth: 220 }}
                    >
                        <option value="">— Select archetype —</option>
                        {ARCHETYPE_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                    {!archetype && (
                        <span style={{ fontSize: 12, color: 'var(--theme-error-500)' }}>
                            Required — select which archetype this 100-day schedule belongs to.
                        </span>
                    )}
                </div>
            )}
            {context === 'partner' && (
                <div style={{
                    marginBottom: 20, padding: '14px 16px',
                    background: 'var(--theme-elevation-100)',
                    border: '1px solid var(--theme-border-color)',
                    borderRadius: 6,
                    display: 'flex', alignItems: 'center', gap: 12,
                }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--theme-elevation-600)', whiteSpace: 'nowrap' }}>
                        Partner:
                    </label>
                    <select
                        value={partnerId ?? ''}
                        onChange={e => setPartnerId(e.target.value ? parseInt(e.target.value, 10) : null)}
                        style={{ ...inputStyle, minWidth: 220 }}
                    >
                        <option value="">— Select partner —</option>
                        {partnerOptions.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    {!partnerId && (
                        <span style={{ fontSize: 12, color: 'var(--theme-error-500)' }}>
                            Required — select which partner this 100-day schedule belongs to.
                        </span>
                    )}
                </div>
            )}
            {context === 'track' && (
                <div style={{
                    marginBottom: 20, padding: '14px 16px',
                    background: 'var(--theme-elevation-100)',
                    border: '1px solid var(--theme-border-color)',
                    borderRadius: 6,
                    display: 'flex', alignItems: 'center', gap: 12,
                }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--theme-elevation-600)', whiteSpace: 'nowrap' }}>
                        Track:
                    </label>
                    <select
                        value={trackSlug}
                        onChange={e => setTrackSlug(e.target.value)}
                        style={{ ...inputStyle, minWidth: 220 }}
                    >
                        <option value="">— Select track —</option>
                        {trackOptions.map(t => (
                            <option key={t.id} value={t.slug} disabled={!t.isActive}>
                                {t.name || t.slug}{!t.isActive ? ' (inactive)' : ''}
                            </option>
                        ))}
                    </select>
                    {!trackSlug && (
                        <span style={{ fontSize: 12, color: 'var(--theme-error-500)' }}>
                            Required — select which track this 100-day schedule belongs to.
                        </span>
                    )}
                </div>
            )}

            {/* Prework grid */}
            <details open style={{ marginBottom: 16 }}>
                <summary style={{
                    padding: '10px 14px',
                    background: 'var(--theme-elevation-100)',
                    border: '1px solid var(--theme-border-color)',
                    borderRadius: 6, cursor: 'pointer', userSelect: 'none',
                    display: 'flex', alignItems: 'center', gap: 10,
                    listStyle: 'none', fontSize: 14, fontWeight: 700,
                }}>
                    <span style={{
                        display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                        background: '#a78bfa', flexShrink: 0,
                    }} />
                    <span style={{ color: 'var(--theme-text)' }}>PREWORK</span>
                    <span style={{ color: 'var(--theme-elevation-500)', fontWeight: 400, fontSize: 13 }}>
                        PW 1–{totalPreworkBlocks}
                    </span>
                    <span style={{
                        marginLeft: 'auto', fontSize: 11, fontWeight: 600,
                        padding: '2px 8px', borderRadius: 3,
                        background: countAssigned(preworkSchedule, 1, totalPreworkBlocks) === totalPreworkBlocks ? 'var(--theme-success-100)' : 'var(--theme-elevation-150)',
                        color: countAssigned(preworkSchedule, 1, totalPreworkBlocks) === totalPreworkBlocks ? 'var(--theme-success-600)' : 'var(--theme-elevation-500)',
                    }}>
                        {countAssigned(preworkSchedule, 1, totalPreworkBlocks)} / {totalPreworkBlocks}
                    </span>
                </summary>

                <div style={{ padding: '12px 4px 4px' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {Array.from({ length: totalPreworkBlocks }, (_, i) => i + 1).map(pw => (
                            <DayCell
                                key={`pw-${pw}`}
                                day={pw}
                                label={`PW ${pw}`}
                                formId={preworkSchedule[String(pw)] ?? null}
                                forms={forms}
                                isActive={activeDay === -pw}
                                onActivate={() => setActiveDay(prev => prev === -pw ? null : -pw)}
                                onSelect={formId => {
                                    setPreworkSchedule(prev => {
                                        const next = { ...prev }
                                        if (formId === null) {
                                            delete next[String(pw)]
                                        } else {
                                            next[String(pw)] = formId
                                        }
                                        return next
                                    })
                                    setActiveDay(null)
                                }}
                            />
                        ))}
                    </div>
                </div>
            </details>

            {/* Phase grids */}
            {PHASES.map(phase => {
                const assigned = countAssigned(schedule, phase.startDay, phase.endDay)
                const total = phase.endDay - phase.startDay + 1
                const weeks = chunkDays(phase.startDay, phase.endDay)

                return (
                    <details key={phase.name} open style={{ marginBottom: 16 }}>
                        <summary style={{
                            padding: '10px 14px',
                            background: 'var(--theme-elevation-100)',
                            border: '1px solid var(--theme-border-color)',
                            borderRadius: 6, cursor: 'pointer', userSelect: 'none',
                            display: 'flex', alignItems: 'center', gap: 10,
                            listStyle: 'none', fontSize: 14, fontWeight: 700,
                        }}>
                            <span style={{
                                display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                                background: phase.color, flexShrink: 0,
                            }} />
                            <span style={{ color: 'var(--theme-text)' }}>{phase.name}</span>
                            <span style={{ color: 'var(--theme-elevation-500)', fontWeight: 400, fontSize: 13 }}>
                                Days {phase.startDay}–{phase.endDay}
                            </span>
                            <span style={{
                                marginLeft: 'auto', fontSize: 11, fontWeight: 600,
                                padding: '2px 8px', borderRadius: 3,
                                background: assigned === total ? 'var(--theme-success-100)' : 'var(--theme-elevation-150)',
                                color: assigned === total ? 'var(--theme-success-600)' : 'var(--theme-elevation-500)',
                            }}>
                                {assigned} / {total}
                            </span>
                        </summary>

                        <div style={{ padding: '12px 4px 4px' }}>
                            {weeks.map((week, wi) => (
                                <div key={wi} style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                                    {week.map(day => (
                                        <DayCell
                                            key={day}
                                            day={day}
                                            formId={schedule[String(day)] ?? null}
                                            forms={forms}
                                            isActive={activeDay === day}
                                            onActivate={() => setActiveDay(prev => prev === day ? null : day)}
                                            onSelect={formId => {
                                                setSchedule(prev => {
                                                    const next = { ...prev }
                                                    if (formId === null) {
                                                        delete next[String(day)]
                                                    } else {
                                                        next[String(day)] = formId
                                                    }
                                                    return next
                                                })
                                                setActiveDay(null)
                                            }}
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </details>
                )
            })}

            {/* Floating save bar */}
            {dirty && (
                <div style={{
                    position: 'fixed', bottom: 24, right: 32, zIndex: 50,
                    display: 'flex', gap: 10, alignItems: 'center',
                    padding: '12px 20px', borderRadius: 8,
                    background: 'var(--theme-elevation-900, #203e5f)',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
                    border: '1px solid var(--theme-elevation-650)',
                    color: '#fff',
                }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>You have unsaved changes</span>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            padding: '7px 18px', borderRadius: 4, fontSize: 13, fontWeight: 700,
                            border: 'none', cursor: saving ? 'default' : 'pointer',
                            background: saving ? '#555' : 'var(--theme-success-500)',
                            color: '#fff',
                        }}
                    >
                        {saving ? 'Saving…' : '💾 Save'}
                    </button>
                </div>
            )}
        </div>
    )
}
