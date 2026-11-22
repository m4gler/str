'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { normalizeArchetypeKey } from '@/lib/curriculum/constants'

interface RuleCondition { metric: string; operator: string; value: number }
interface StrengthItem { text: string }
interface Archetype {
    key: string; emoji: string; tagline: string; bestRole: string
    matchMode: 'all' | 'any'; rules: RuleCondition[]
    strengths: StrengthItem[]; blindSpots: StrengthItem[]
}
interface TrackRule { track: string; matchMode: 'all' | 'any'; rules: RuleCondition[] }
interface ScoringSettings {
    EXEC_high: number; EXEC_min: number; ADAPT_high: number; ES_low: number
    RT_low: number; RT_high: number; RT_ideal: number; RISK_CAL_slope: number; HONESTY_flag: number
}
interface FormulaWeights {
    execWeightC: number; execWeightSE: number; execWeightES: number
    adaptWeightO: number; adaptWeightE: number; adaptWeightES: number
}

const METRICS = [
    { label: 'E (Extraversion)', value: 'E' },
    { label: 'A (Agreeableness)', value: 'A' },
    { label: 'C (Conscientiousness)', value: 'C' },
    { label: 'N (Neuroticism)', value: 'N' },
    { label: 'O (Openness)', value: 'O' },
    { label: 'ES (Emotional Stability)', value: 'ES' },
    { label: 'SE (Self-Efficacy)', value: 'SE' },
    { label: 'RT (Risk-Taking)', value: 'RT' },
    { label: 'EXEC (Execution)', value: 'EXEC' },
    { label: 'ADAPT (Adaptability)', value: 'ADAPT' },
    { label: 'RISK_CAL (Risk Calibration)', value: 'RISK_CAL' },
    { label: 'RT_DISTANCE (|RT − ideal|)', value: 'RT_DISTANCE' },
]
const OPERATORS = ['>=', '<=', '>', '<']

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px',
    background: 'var(--theme-input-bg)', border: '1px solid var(--theme-border-color)',
    borderRadius: 4, fontSize: 13, color: 'var(--theme-text)', outline: 'none',
}

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }

const numStyle: React.CSSProperties = { ...inputStyle, width: 80, textAlign: 'right' as const }

function SmallBtn({ onClick, title, children, variant = 'default', disabled }: {
    onClick: () => void; title?: string; children: React.ReactNode
    variant?: 'default' | 'danger' | 'success'; disabled?: boolean
}) {
    const colors = { default: 'var(--theme-elevation-300)', danger: '#ef4444', success: '#22c55e' }
    return (
        <button
            type="button" onClick={onClick} title={title} disabled={disabled}
            style={{
                padding: '4px 10px', fontSize: 12, fontWeight: 600,
                border: `1px solid ${colors[variant]}`, borderRadius: 4,
                background: variant === 'default' ? 'transparent' : `${colors[variant]}18`,
                color: variant === 'default' ? 'var(--theme-text)' : colors[variant],
                cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
                transition: 'all 0.15s',
            }}
        >{children}</button>
    )
}

function RuleEditor({ rule, onChange, onDelete }: {
    rule: RuleCondition; onChange: (r: RuleCondition) => void; onDelete: () => void
}) {
    return (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <select value={rule.metric} onChange={e => onChange({ ...rule, metric: e.target.value })} style={{ ...selectStyle, flex: 2 }}>
                <option value="">Select metric...</option>
                {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select value={rule.operator} onChange={e => onChange({ ...rule, operator: e.target.value })} style={{ ...selectStyle, width: 60, flex: 0 }}>
                {OPERATORS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <input
                type="number" step="0.1" value={rule.value}
                onChange={e => onChange({ ...rule, value: parseFloat(e.target.value) || 0 })}
                style={numStyle}
            />
            <SmallBtn onClick={onDelete} variant="danger" title="Remove rule">✕</SmallBtn>
        </div>
    )
}

function TextList({ items, onChange, placeholder }: {
    items: StrengthItem[]; onChange: (items: StrengthItem[]) => void; placeholder: string
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {items.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--theme-elevation-450)', width: 14, textAlign: 'center' }}>{i + 1}</span>
                    <input
                        value={item.text}
                        onChange={e => { const n = [...items]; n[i] = { text: e.target.value }; onChange(n) }}
                        placeholder={placeholder}
                        style={{ ...inputStyle, flex: 1 }}
                    />
                    <SmallBtn onClick={() => onChange(items.filter((_, idx) => idx !== i))} variant="danger" title="Remove">✕</SmallBtn>
                </div>
            ))}
            <SmallBtn onClick={() => onChange([...items, { text: '' }])} variant="success">+ Add</SmallBtn>
        </div>
    )
}

function ArchetypeCard({ archetype, index, total, onChange, onDelete, onMove }: {
    archetype: Archetype; index: number; total: number
    onChange: (a: Archetype) => void; onDelete: () => void; onMove: (dir: -1 | 1) => void
}) {
    const [collapsed, setCollapsed] = useState(true)
    const isLast = index === total - 1
    const ruleCount = archetype.rules.length

    return (
        <div style={{
            border: '1px solid var(--theme-border-color)', borderRadius: 8,
            background: 'var(--theme-elevation-50)', overflow: 'hidden',
        }}>
            <div
                onClick={() => setCollapsed(!collapsed)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                    cursor: 'pointer', background: collapsed ? 'transparent' : 'var(--theme-elevation-100)',
                    transition: 'background 0.15s',
                }}
            >
                <span style={{ fontSize: 22 }}>{archetype.emoji || '🔮'}</span>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--theme-text)' }}>
                        #{index + 1} — {archetype.key || 'Unnamed'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--theme-elevation-500)' }}>
                        {archetype.tagline} · {ruleCount} rule{ruleCount !== 1 ? 's' : ''} ({archetype.matchMode.toUpperCase()})
                        {ruleCount === 0 && ' · fallback'}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                    <SmallBtn onClick={() => onMove(-1)} disabled={index === 0} title="Move up">↑</SmallBtn>
                    <SmallBtn onClick={() => onMove(1)} disabled={isLast} title="Move down">↓</SmallBtn>
                    <SmallBtn onClick={onDelete} variant="danger" title="Delete archetype">🗑</SmallBtn>
                </div>
                <span style={{ fontSize: 14, color: 'var(--theme-elevation-400)', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▼</span>
            </div>

            {!collapsed && (
                <div style={{ padding: '14px', borderTop: '1px solid var(--theme-border-color)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 1fr', gap: 8 }}>
                        <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-elevation-500)', marginBottom: 4, display: 'block' }}>Name</label>
                            <input value={archetype.key} onChange={e => onChange({ ...archetype, key: e.target.value })} style={inputStyle} />
                        </div>
                        <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-elevation-500)', marginBottom: 4, display: 'block' }}>Emoji</label>
                            <input value={archetype.emoji} onChange={e => onChange({ ...archetype, emoji: e.target.value })} style={inputStyle} />
                        </div>
                        <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-elevation-500)', marginBottom: 4, display: 'block' }}>Tagline</label>
                            <input value={archetype.tagline} onChange={e => onChange({ ...archetype, tagline: e.target.value })} style={inputStyle} />
                        </div>
                    </div>

                    <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-elevation-500)', marginBottom: 4, display: 'block' }}>Best Team Role</label>
                        <input value={archetype.bestRole} onChange={e => onChange({ ...archetype, bestRole: e.target.value })} style={inputStyle} />
                    </div>

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--theme-text)' }}>
                                Detection Rules
                            </label>
                            <select
                                value={archetype.matchMode}
                                onChange={e => onChange({ ...archetype, matchMode: e.target.value as 'all' | 'any' })}
                                style={{ ...selectStyle, width: 'auto', fontSize: 11 }}
                            >
                                <option value="all">ALL must pass (AND)</option>
                                <option value="any">ANY can pass (OR)</option>
                            </select>
                        </div>
                        {archetype.rules.map((rule, ri) => (
                            <RuleEditor
                                key={ri} rule={rule}
                                onChange={r => { const n = [...archetype.rules]; n[ri] = r; onChange({ ...archetype, rules: n }) }}
                                onDelete={() => onChange({ ...archetype, rules: archetype.rules.filter((_, idx) => idx !== ri) })}
                            />
                        ))}
                        <SmallBtn onClick={() => onChange({ ...archetype, rules: [...archetype.rules, { metric: 'EXEC', operator: '>=', value: 3.0 }] })} variant="success">+ Add Rule</SmallBtn>
                        {archetype.rules.length === 0 && (
                            <div style={{ fontSize: 11, color: 'var(--theme-warning-500)', marginTop: 4, fontStyle: 'italic' }}>
                                ⚠ No rules = this archetype matches everyone (fallback). Place it last!
                            </div>
                        )}
                    </div>

                    <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--theme-text)', marginBottom: 6, display: 'block' }}>Core Strengths</label>
                        <TextList items={archetype.strengths || []} onChange={s => onChange({ ...archetype, strengths: s })} placeholder="Strength description..." />
                    </div>

                    <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--theme-text)', marginBottom: 6, display: 'block' }}>Blind Spots</label>
                        <TextList items={archetype.blindSpots || []} onChange={b => onChange({ ...archetype, blindSpots: b })} placeholder="Blind spot description..." />
                    </div>
                </div>
            )}
        </div>
    )
}

function TrackRuleCard({ trackRule, index, total, onChange, onDelete, onMove }: {
    trackRule: TrackRule; index: number; total: number
    onChange: (t: TrackRule) => void; onDelete: () => void; onMove: (dir: -1 | 1) => void
}) {
    return (
        <div style={{ border: '1px solid var(--theme-border-color)', borderRadius: 8, padding: 12, background: 'var(--theme-elevation-50)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--theme-elevation-450)' }}>#{index + 1}</span>
                <input value={trackRule.track} onChange={e => onChange({ ...trackRule, track: e.target.value })} placeholder="Track name" style={{ ...inputStyle, flex: 1, fontWeight: 600 }} />
                <select value={trackRule.matchMode} onChange={e => onChange({ ...trackRule, matchMode: e.target.value as 'all' | 'any' })} style={{ ...selectStyle, width: 'auto', fontSize: 11 }}>
                    <option value="all">AND</option>
                    <option value="any">OR</option>
                </select>
                <SmallBtn onClick={() => onMove(-1)} disabled={index === 0}>↑</SmallBtn>
                <SmallBtn onClick={() => onMove(1)} disabled={index === total - 1}>↓</SmallBtn>
                <SmallBtn onClick={onDelete} variant="danger">✕</SmallBtn>
            </div>
            {trackRule.rules.map((rule, ri) => (
                <RuleEditor
                    key={ri} rule={rule}
                    onChange={r => { const n = [...trackRule.rules]; n[ri] = r; onChange({ ...trackRule, rules: n }) }}
                    onDelete={() => onChange({ ...trackRule, rules: trackRule.rules.filter((_, idx) => idx !== ri) })}
                />
            ))}
            <SmallBtn onClick={() => onChange({ ...trackRule, rules: [...trackRule.rules, { metric: 'EXEC', operator: '>=', value: 3.0 }] })} variant="success">+ Add Rule</SmallBtn>
            {trackRule.rules.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--theme-warning-500)', marginTop: 4, fontStyle: 'italic' }}>⚠ Fallback track (matches all)</div>
            )}
        </div>
    )
}

function moveItem<T>(arr: T[], from: number, to: number): T[] {
    if (to < 0 || to >= arr.length) return arr
    const n = [...arr]; const [item] = n.splice(from, 1); n.splice(to, 0, item); return n
}

function SectionHeader({ children }: { children: React.ReactNode }) {
    return (
        <h3 style={{
            fontSize: 15, fontWeight: 700, color: 'var(--theme-text)',
            borderBottom: '2px solid var(--theme-elevation-200)', paddingBottom: 8, marginBottom: 12, marginTop: 24,
        }}>{children}</h3>
    )
}

function NumberField({ label, value, onChange, help }: { label: string; value: number; onChange: (v: number) => void; help?: string }) {
    return (
        <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-elevation-500)', marginBottom: 4, display: 'block' }}>{label}</label>
            <input type="number" step="0.1" value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)} style={inputStyle} />
            {help && <div style={{ fontSize: 10, color: 'var(--theme-elevation-400)', marginTop: 2 }}>{help}</div>}
        </div>
    )
}

export default function PersonalityEditor() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [savedAt, setSavedAt] = useState<string | null>(null)
    const [dirty, setDirty] = useState(false)
    const initialRef = useRef<string>('')

    const [archetypes, setArchetypes] = useState<Archetype[]>([])
    const [trackRules, setTrackRules] = useState<TrackRule[]>([])
    const [scoring, setScoring] = useState<ScoringSettings>({
        EXEC_high: 4.0, EXEC_min: 3.2, ADAPT_high: 3.9, ES_low: 3.0,
        RT_low: 3.0, RT_high: 4.4, RT_ideal: 3.7, RISK_CAL_slope: 2.0, HONESTY_flag: 2.0,
    })
    const [weights, setWeights] = useState<FormulaWeights>({
        execWeightC: 0.45, execWeightSE: 0.35, execWeightES: 0.2,
        adaptWeightO: 0.55, adaptWeightE: 0.25, adaptWeightES: 0.2,
    })
    const [reverseItems, setReverseItems] = useState('E2,E4,A2,C2,C4,N2,N4,O2,O3,SE4,RT2,RT4')
    const [scaleItems, setScaleItems] = useState<Record<string, string>>({
        E: 'E1,E2,E3,E4', A: 'A1,A2,A3,A4', C: 'C1,C2,C3,C4',
        N: 'N1,N2,N3,N4', O: 'O1,O2,O3,O4', SE: 'SE1,SE2,SE3,SE4,SE5', RT: 'RT1,RT2,RT3,RT4,RT5',
    })

    const getSnapshot = useCallback(() => JSON.stringify({ archetypes, trackRules, scoring, weights, reverseItems, scaleItems }), [archetypes, trackRules, scoring, weights, reverseItems, scaleItems])

    useEffect(() => {
        fetch('/api/globals/platform-settings?depth=0')
            .then(r => { if (!r.ok) throw new Error('Failed to load'); return r.json() })
            .then(data => {
                const p = data.personality || {}
                if (Array.isArray(p.archetypes) && p.archetypes.length > 0) {
                    setArchetypes(p.archetypes.map((a: any) => ({
                        key: a.key ? normalizeArchetypeKey(a.key) : '', emoji: a.emoji || '', tagline: a.tagline || '',
                        bestRole: a.bestRole || '', matchMode: a.matchMode || 'all',
                        rules: Array.isArray(a.rules) ? a.rules.filter((r: any) => r.metric && r.operator && typeof r.value === 'number') : [],
                        strengths: Array.isArray(a.strengths) ? a.strengths : [],
                        blindSpots: Array.isArray(a.blindSpots) ? a.blindSpots : [],
                    })))
                }
                if (Array.isArray(p.trackRules) && p.trackRules.length > 0) {
                    setTrackRules(p.trackRules.map((t: any) => ({
                        track: t.track || '', matchMode: t.matchMode || 'all',
                        rules: Array.isArray(t.rules) ? t.rules.filter((r: any) => r.metric && r.operator && typeof r.value === 'number') : [],
                    })))
                }
                if (p.scoringSettings) {
                    setScoring(prev => ({ ...prev, ...Object.fromEntries(Object.entries(p.scoringSettings).filter(([, v]) => typeof v === 'number')) }))
                }
                if (p.formulaWeights) {
                    setWeights(prev => ({ ...prev, ...Object.fromEntries(Object.entries(p.formulaWeights).filter(([, v]) => typeof v === 'number')) }))
                }
                if (p.reverseItems) setReverseItems(p.reverseItems)
                if (p.scaleItems) {
                    setScaleItems(prev => {
                        const n = { ...prev }
                        for (const k of Object.keys(n)) { if (typeof p.scaleItems[k] === 'string') n[k] = p.scaleItems[k] }
                        return n
                    })
                }
                setTimeout(() => {
                    initialRef.current = JSON.stringify({
                        archetypes: p.archetypes || [], trackRules: p.trackRules || [],
                        scoring: p.scoringSettings || {}, weights: p.formulaWeights || {},
                        reverseItems: p.reverseItems || '', scaleItems: p.scaleItems || {},
                    })
                }, 0)
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => {
        if (loading) return
        setDirty(true)
    }, [archetypes, trackRules, scoring, weights, reverseItems, scaleItems])

    const handleSave = async () => {
        setSaving(true); setError(null)
        try {
            const payload: any = {
                personality: {
                    archetypes: archetypes.map(a => ({
                        key: a.key, emoji: a.emoji, tagline: a.tagline, bestRole: a.bestRole,
                        matchMode: a.matchMode,
                        rules: a.rules.map(r => ({ metric: r.metric, operator: r.operator, value: r.value })),
                        strengths: (a.strengths || []).map(s => ({ text: s.text })),
                        blindSpots: (a.blindSpots || []).map(s => ({ text: s.text })),
                    })),
                    trackRules: trackRules.map(t => ({
                        track: t.track, matchMode: t.matchMode,
                        rules: t.rules.map(r => ({ metric: r.metric, operator: r.operator, value: r.value })),
                    })),
                    scoringSettings: scoring,
                    formulaWeights: weights,
                    reverseItems,
                    scaleItems,
                },
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
        } catch (e: any) {
            setError(e.message)
        } finally {
            setSaving(false)
        }
    }

    const addArchetype = () => {
        setArchetypes(prev => [...prev, {
            key: 'New Archetype', emoji: '🔮', tagline: '', bestRole: '',
            matchMode: 'all', rules: [], strengths: [], blindSpots: [],
        }])
    }

    const addTrackRule = () => {
        setTrackRules(prev => [...prev, { track: 'New Track', matchMode: 'all', rules: [] }])
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, color: 'var(--theme-elevation-500)' }}>
                <div style={{ width: 28, height: 28, border: '3px solid var(--theme-elevation-250)', borderTopColor: 'var(--theme-success-500)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Loading personality config…
            </div>
        )
    }

    const execSum = weights.execWeightC + weights.execWeightSE + weights.execWeightES
    const adaptSum = weights.adaptWeightO + weights.adaptWeightE + weights.adaptWeightES

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 var(--base) calc(var(--base) * 2)' }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            <div style={{
                position: 'sticky', top: 0, zIndex: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 0', marginBottom: 8,
                background: 'var(--theme-bg)', borderBottom: '1px solid var(--theme-border-color)',
                gap: 12, flexWrap: 'wrap',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <a href="/admin/globals/platform-settings" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--theme-elevation-650)', textDecoration: 'none', fontSize: 13 }}>
                        ← Settings
                    </a>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--theme-text)' }}>🧠 Personality Engine</h2>
                    {dirty && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 3, background: 'var(--theme-warning-100)', color: 'var(--theme-warning-600)', fontWeight: 600 }}>Unsaved changes</span>}
                    {savedAt && !dirty && <span style={{ fontSize: 11, color: 'var(--theme-success-600)', fontWeight: 500 }}>✓ Saved at {savedAt}</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--theme-elevation-450)' }}>
                        {archetypes.length} archetype{archetypes.length !== 1 ? 's' : ''} · {trackRules.length} track rule{trackRules.length !== 1 ? 's' : ''}
                    </span>
                    <button
                        type="button" onClick={handleSave} disabled={saving}
                        style={{
                            padding: '8px 20px', fontSize: 13, fontWeight: 700,
                            border: 'none', borderRadius: 6,
                            background: dirty ? 'var(--theme-success-500)' : 'var(--theme-elevation-300)',
                            color: dirty ? '#fff' : 'var(--theme-text)',
                            cursor: saving ? 'wait' : 'pointer', transition: 'all 0.2s',
                        }}
                    >{saving ? 'Saving…' : 'Save'}</button>
                </div>
            </div>

            {error && (
                <div style={{ padding: '10px 14px', marginBottom: 16, borderRadius: 6, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13 }}>
                    ❌ {error}
                </div>
            )}

            <SectionHeader>🦫 Archetypes (Priority Order — First Match Wins)</SectionHeader>
            <p style={{ fontSize: 12, color: 'var(--theme-elevation-500)', marginBottom: 12 }}>
                Archetypes are evaluated top-to-bottom. The first archetype whose rules are satisfied is assigned. Place the fallback (no rules) at the bottom.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {archetypes.map((a, i) => (
                    <ArchetypeCard
                        key={i} archetype={a} index={i} total={archetypes.length}
                        onChange={updated => { const n = [...archetypes]; n[i] = updated; setArchetypes(n) }}
                        onDelete={() => setArchetypes(prev => prev.filter((_, idx) => idx !== i))}
                        onMove={dir => setArchetypes(prev => moveItem(prev, i, i + dir))}
                    />
                ))}
            </div>
            <div style={{ marginTop: 8 }}>
                <SmallBtn onClick={addArchetype} variant="success">+ Add Archetype</SmallBtn>
            </div>

            <SectionHeader>🛤 Track Assignment Rules (Priority Order)</SectionHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {trackRules.map((t, i) => (
                    <TrackRuleCard
                        key={i} trackRule={t} index={i} total={trackRules.length}
                        onChange={updated => { const n = [...trackRules]; n[i] = updated; setTrackRules(n) }}
                        onDelete={() => setTrackRules(prev => prev.filter((_, idx) => idx !== i))}
                        onMove={dir => setTrackRules(prev => moveItem(prev, i, i + dir))}
                    />
                ))}
            </div>
            <div style={{ marginTop: 8 }}>
                <SmallBtn onClick={addTrackRule} variant="success">+ Add Track Rule</SmallBtn>
            </div>

            <SectionHeader>⚙️ Scoring Thresholds</SectionHeader>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <NumberField label="EXEC High (Operator Track)" value={scoring.EXEC_high} onChange={v => setScoring(s => ({ ...s, EXEC_high: v }))} />
                <NumberField label="EXEC Min (Admission Gate)" value={scoring.EXEC_min} onChange={v => setScoring(s => ({ ...s, EXEC_min: v }))} />
                <NumberField label="ADAPT High (Explorer)" value={scoring.ADAPT_high} onChange={v => setScoring(s => ({ ...s, ADAPT_high: v }))} />
                <NumberField label="ES Low (Support Flag)" value={scoring.ES_low} onChange={v => setScoring(s => ({ ...s, ES_low: v }))} />
                <NumberField label="RT Low" value={scoring.RT_low} onChange={v => setScoring(s => ({ ...s, RT_low: v }))} />
                <NumberField label="RT High (Reckless)" value={scoring.RT_high} onChange={v => setScoring(s => ({ ...s, RT_high: v }))} />
                <NumberField label="RT Ideal (Guardian)" value={scoring.RT_ideal} onChange={v => setScoring(s => ({ ...s, RT_ideal: v }))} />
                <NumberField label="Risk Cal Slope" value={scoring.RISK_CAL_slope} onChange={v => setScoring(s => ({ ...s, RISK_CAL_slope: v }))} />
                <NumberField label="Honesty Flag (≤)" value={scoring.HONESTY_flag} onChange={v => setScoring(s => ({ ...s, HONESTY_flag: v }))} />
            </div>

            <SectionHeader>📐 Formula Weights</SectionHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--theme-text)' }}>EXEC = wC·C + wSE·SE + wES·ES</span>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 3, background: Math.abs(execSum - 1) < 0.01 ? '#dcfce7' : '#fef9c3', color: Math.abs(execSum - 1) < 0.01 ? '#16a34a' : '#ca8a04', fontWeight: 600 }}>
                            Σ = {execSum.toFixed(2)}
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <NumberField label="C weight" value={weights.execWeightC} onChange={v => setWeights(w => ({ ...w, execWeightC: v }))} />
                        <NumberField label="SE weight" value={weights.execWeightSE} onChange={v => setWeights(w => ({ ...w, execWeightSE: v }))} />
                        <NumberField label="ES weight" value={weights.execWeightES} onChange={v => setWeights(w => ({ ...w, execWeightES: v }))} />
                    </div>
                </div>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--theme-text)' }}>ADAPT = wO·O + wE·E + wES·ES</span>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 3, background: Math.abs(adaptSum - 1) < 0.01 ? '#dcfce7' : '#fef9c3', color: Math.abs(adaptSum - 1) < 0.01 ? '#16a34a' : '#ca8a04', fontWeight: 600 }}>
                            Σ = {adaptSum.toFixed(2)}
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <NumberField label="O weight" value={weights.adaptWeightO} onChange={v => setWeights(w => ({ ...w, adaptWeightO: v }))} />
                        <NumberField label="E weight" value={weights.adaptWeightE} onChange={v => setWeights(w => ({ ...w, adaptWeightE: v }))} />
                        <NumberField label="ES weight" value={weights.adaptWeightES} onChange={v => setWeights(w => ({ ...w, adaptWeightES: v }))} />
                    </div>
                </div>
            </div>

            <SectionHeader>🔄 Reverse-Keyed Items</SectionHeader>
            <p style={{ fontSize: 12, color: 'var(--theme-elevation-500)', marginBottom: 8 }}>
                Comma-separated question IDs that are reverse-scored (6 − raw value).
            </p>
            <input value={reverseItems} onChange={e => setReverseItems(e.target.value)} style={inputStyle} />

            <SectionHeader>📊 Scale → Question ID Mapping</SectionHeader>
            <p style={{ fontSize: 12, color: 'var(--theme-elevation-500)', marginBottom: 8 }}>
                Comma-separated question IDs for each personality scale.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(scaleItems).map(([key, val]) => (
                    <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <label style={{ fontSize: 12, fontWeight: 700, width: 30, color: 'var(--theme-text)' }}>{key}</label>
                        <input value={val} onChange={e => setScaleItems(s => ({ ...s, [key]: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
                    </div>
                ))}
            </div>

            <div style={{ height: 40 }} />
        </div>
    )
}
