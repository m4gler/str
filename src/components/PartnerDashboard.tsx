'use client'

import { useState, useEffect, useTransition, useRef, useCallback, useMemo } from 'react'
import {
    reviewProject,
    updatePartnerBrandingColors,
    updatePartnerBannedWords,
    updatePartnerLogo,
    submitPartnerDecision,
    createMentor,
    listMentors,
    updateMentorProfile,
    updatePartnerReferralTracks,
    createPartnerInviteLink,
    setPartnerInviteLinkActive,
} from '@/app/actions'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SiteFooter from '@/components/SiteFooter'
import MesgaHorizontalLogo from '@/components/MesgaHorizontalLogo'
import FounderProgressPanel, { type FounderProgressTimeline } from '@/components/FounderProgressPanel'
import PartnerMentorPanel from '@/components/PartnerMentorPanel'
import type { BrandingColors, PhaseColorConfig, ProgramPhase, ProgramGate } from '@/lib/partnerBranding'
import { DEFAULT_PHASE_COLORS, getPhaseTextColor, getPhaseBackground, getPhaseBarColor, getPhaseColorConfig, getEffectiveProgram, normaliseBranding } from '@/lib/partnerBranding'
import { CANONICAL_ARCHETYPES, normalizeArchetypeKey } from '@/lib/curriculum/constants'
import { buildNormalizedArchetypeMap } from '@/lib/personalityConfig'

/* ─── Helpers ────────────────────────────────────────────────────────────── */

interface ParsedDescription {
    name: string | null
    oneliner: string | null
    problem: string | null
    industry: string | null
    path: string | null
    stage: string | null
}

function parseProjectDescription(desc: string): ParsedDescription {
    const result: ParsedDescription = { name: null, oneliner: null, problem: null, industry: null, path: null, stage: null }
    for (const line of desc.split('\n')) {
        const colon = line.indexOf(': ')
        if (colon === -1) continue
        const key = line.slice(0, colon).trim().toLowerCase()
        const val = line.slice(colon + 2).trim()
        if (!val) continue
        if (key === 'name') result.name = val
        else if (key === 'one-liner') result.oneliner = val
        else if (key === 'problem') result.problem = val
        else if (key === 'industry') result.industry = val
        else if (key === 'path') result.path = val
        else if (key === 'stage') result.stage = val
    }
    return result
}

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface Submission {
    id: number
    projectDescription: string
    status: 'pending' | 'approved' | 'denied'
    partnerComment?: string | null
    autoDenied?: boolean
    bannedWordMatched?: string | null
    reviewedAt?: string | null
    reviewedBy?: any
    createdAt: string
    user?: { id: number; email: string; partner?: any }
}

interface FormQuestion {
    question_id: string
    question_text: string
    question_type: string
    choices?: { label: string; value: string }[]
}

interface FormSection {
    title: string
    questions?: FormQuestion[]
}

interface PartnerFounder {
    id: number
    email: string
    programStatus: string
    programAttempts: number
    hasPaid100Days: boolean
    createdAt: string
    archetype?: string | null
    archetypeEmoji?: string | null
    track?: string | null
    personalityScores?: any
    intakeSubmission?: {
        formTitle?: string | null
        formSections?: FormSection[] | null
        submissionData?: any
        createdAt: string
    } | null
    progressTimeline?: FounderProgressTimeline | null
    projectSubmission?: { status: string; partnerComment?: string | null; projectDescription?: string | null; track?: any } | null
}

interface PartnerOption {
    id: number
    name: string
    slug: string
    tracks?: Array<{ id: number; name: string; slug: string }>
}

interface AvailableTrackOption {
    id: number
    name: string
    slug: string
}

interface PartnerInviteLink {
    id: number
    label: string
    token: string
    isActive: boolean
    createdAt?: string | null
    lastUsedAt?: string | null
    useCount: number
    partnerId: number | null
    partnerName?: string | null
    partnerSlug?: string | null
    track?: { id: number; name: string; slug: string } | null
}

/* ─── Status colours ─────────────────────────────────────────────────────── */

const STATUS_COLORS = {
    pending: { color: '#E0C188', bg: '#E0C18812', border: '#E0C18828', label: 'Pending' },
    approved: { color: '#2CB1A1', bg: '#2CB1A112', border: '#2CB1A128', label: 'Approved' },
    denied: { color: '#C96A4A', bg: '#C96A4A12', border: '#C96A4A28', label: 'Denied' },
} as const

const PROG_STATUS_COLORS: Record<string, { color: string; label: string }> = {
    not_started: { color: 'rgba(255,255,255,0.3)', label: 'Not started' },
    active: { color: '#2CB1A1', label: 'Active' },
    failed: { color: '#C96A4A', label: 'Failed' },
    completed: { color: '#ffcc00', label: 'Completed' },
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: 'pending' | 'approved' | 'denied' }) {
    const cfg = STATUS_COLORS[status]
    return (
        <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border"
            style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: cfg.border }}
        >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
            {cfg.label}
        </span>
    )
}

function formatAnswer(value: unknown, question: FormQuestion): string {
    if (value === null || value === undefined || value === '') return '—'
    if (question.question_type === 'yes_no') {
        if (value === true || value === 'true' || value === 'yes' || value === 'Yes') return 'Yes'
        if (value === false || value === 'false' || value === 'no' || value === 'No') return 'No'
    }
    if (question.question_type === 'multiple_choice_multiple' && Array.isArray(value)) {
        return value.map((v) => {
            const choice = question.choices?.find((c) => c.value === v)
            return choice ? choice.label : String(v)
        }).join(', ')
    }
    if ((question.question_type === 'multiple_choice_single' || question.question_type === 'dropdown') && question.choices) {
        const choice = question.choices.find((c) => c.value === value)
        if (choice) return choice.label
    }
    return String(value)
}

function ReviewModal({ submission, intakeSubmission, onClose, onDone }: {
    submission: Submission
    intakeSubmission?: { formSections?: FormSection[] | null; submissionData?: any } | null
    onClose: () => void
    onDone: () => void
}) {
    const [action, setAction] = useState<'approved' | 'denied' | null>(null)
    const [comment, setComment] = useState(submission.partnerComment ?? '')
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!action) return
        setError(null)
        startTransition(async () => {
            const result = await reviewProject(submission.id, action, comment)
            if ('error' in result) setError(result.error)
            else onDone()
        })
    }

    const sections = intakeSubmission?.formSections ?? []
    const submissionData = intakeSubmission?.submissionData ?? {}

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-white/10 bg-[#203e5f] shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-8 pt-8 pb-4 shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-white">Review Application</h2>
                        <p className="text-[11px] text-white/30 mt-0.5">{submission.user?.email}</p>
                    </div>
                    <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Scrollable intake form content */}
                <div className="overflow-y-auto flex-1 px-8 pb-4">
                    {sections.length > 0 ? (
                        <div className="space-y-6">
                            {sections.map((section, si) => {
                                const answeredQuestions = (section.questions ?? []).filter(q => {
                                    const val = submissionData[q.question_id]
                                    return val !== undefined && val !== null && val !== ''
                                })
                                if (answeredQuestions.length === 0) return null
                                return (
                                    <div key={si}>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3 border-b border-white/5 pb-2">
                                            {section.title}
                                        </p>
                                        <div className="space-y-1">
                                            {answeredQuestions.map(q => {
                                                const raw = submissionData[q.question_id]
                                                const answer = formatAnswer(raw, q)
                                                if (answer === '—') return null
                                                const isLink = typeof raw === 'string' && (raw.startsWith('http://') || raw.startsWith('https://'))
                                                return (
                                                    <div key={q.question_id} className="rounded-xl bg-white/3 border border-white/5 px-4 py-3">
                                                        <p className="text-[10px] font-semibold text-white/35 mb-1 leading-tight">{q.question_text}</p>
                                                        {isLink ? (
                                                            <a href={raw} target="_blank" rel="noopener noreferrer" className="text-sm text-[#ffcc00] underline break-all">
                                                                {q.question_type === 'file_upload' ? (raw.split('/').pop() || 'View file') : raw}
                                                            </a>
                                                        ) : (
                                                            <p className="text-white/75 text-sm leading-relaxed whitespace-pre-wrap">{answer}</p>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
                            <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{submission.projectDescription}</p>
                        </div>
                    )}
                </div>

                {/* Decision form — always visible at bottom */}
                <form onSubmit={handleSubmit} className="px-8 pb-8 pt-4 space-y-4 border-t border-white/5 shrink-0">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">Decision</p>
                        <div className="grid grid-cols-2 gap-3">
                            {(['approved', 'denied'] as const).map(opt => {
                                const cfg = STATUS_COLORS[opt]
                                const selected = action === opt
                                return (
                                    <button key={opt} type="button" onClick={() => setAction(opt)}
                                        className="py-3 rounded-2xl border font-bold text-sm transition-all"
                                        style={{
                                            color: selected ? cfg.color : 'rgba(255,255,255,0.3)',
                                            backgroundColor: selected ? cfg.bg : 'transparent',
                                            borderColor: selected ? cfg.border : 'rgba(255,255,255,0.08)',
                                        }}>
                                        {opt === 'approved' ? 'Approve' : 'Deny'}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">
                            Comment <span className="text-white/20 normal-case">(visible to founder)</span>
                        </label>
                        <textarea value={comment} onChange={e => setComment(e.target.value)} rows={4}
                            placeholder="Optional feedback for the founder..."
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/20 resize-none transition-all" />
                    </div>

                    {error && <p className="text-sm text-[#C96A4A] bg-[#C96A4A]/10 border border-[#C96A4A]/20 rounded-xl px-4 py-3">{error}</p>}

                    <button type="submit" disabled={!action || isPending}
                        className="w-full py-3 rounded-full font-bold text-sm text-[#1a2634] transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: action === 'approved' ? 'linear-gradient(135deg,#2CB1A1,#ffcc00)' : action === 'denied' ? 'linear-gradient(135deg,#C96A4A,#e05a3a)' : '#333' }}>
                        {isPending ? 'Saving...' : action ? `Confirm ${action === 'approved' ? 'Approval' : 'Denial'}` : 'Select a decision'}
                    </button>
                </form>
            </div>
        </div>
    )
}

function BannedWordsPanel({ currentWords, onSave }: { currentWords: string; onSave: (w: string) => Promise<void> }) {
    const [words, setWords] = useState(currentWords)
    const [isPending, startTransition] = useTransition()
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState<string | null>(null)

    function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setError(null); setSaved(false)
        startTransition(async () => {
            try { await onSave(words); setSaved(true); setTimeout(() => setSaved(false), 3000) }
            catch (err: any) { setError(err?.message || 'Failed to save') }
        })
    }

    return (
        <div className="rounded-3xl border border-white/8 bg-[#203e5f]/60 p-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-xl bg-[#C96A4A]/10 border border-[#C96A4A]/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-[#C96A4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-sm font-bold text-white">Banned Words</h3>
                    <p className="text-[10px] text-white/30">Auto-deny on match</p>
                </div>
            </div>
            <p className="text-xs text-white/25 leading-relaxed mb-3">
                Separate with commas, spaces, or newlines. Only exact whole-word matches trigger denial (e.g. &ldquo;ass&rdquo; won&apos;t match &ldquo;assignment&rdquo;).
            </p>
            <form onSubmit={handleSave} className="space-y-3">
                <textarea value={words} onChange={e => setWords(e.target.value)} rows={5}
                    placeholder={"e.g. drugs, weapons\nterrorism"}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-xs placeholder-white/15 focus:outline-none focus:border-[#C96A4A]/40 resize-none font-mono" />
                {error && <p className="text-xs text-[#C96A4A]">{error}</p>}
                <button type="submit" disabled={isPending}
                    className="px-4 py-2 rounded-full text-xs font-bold border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all disabled:opacity-40">
                    {isPending ? 'Saving...' : saved ? 'Saved ✓' : 'Save'}
                </button>
            </form>
        </div>
    )
}

function LogoUploadPanel({ currentLogoUrl }: { currentLogoUrl?: string | null }) {
    const [preview, setPreview] = useState<string | null>(currentLogoUrl ?? null)
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const [saved, setSaved] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    function handleFile(file: File) {
        setError(null); setSaved(false)
        const reader = new FileReader()
        reader.onload = e => setPreview(e.target?.result as string)
        reader.readAsDataURL(file)

        const formData = new FormData()
        formData.append('logo', file)
        startTransition(async () => {
            const result = await updatePartnerLogo(formData)
            if ('error' in result) { setError(result.error); setPreview(currentLogoUrl ?? null) }
            else { setSaved(true); setTimeout(() => setSaved(false), 3000) }
        })
    }

    return (
        <div className="rounded-3xl border border-white/8 bg-[#203e5f]/60 p-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-xl bg-[#ffcc00]/10 border border-[#ffcc00]/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-[#ffcc00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M13.5 12a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-sm font-bold text-white">Partner Logo</h3>
                    <p className="text-[10px] text-white/30">Shown on referred users&apos; dashboards</p>
                </div>
            </div>

            {preview && (
                <div className="mb-4 p-3 rounded-2xl border border-white/8 bg-white/3 flex items-center justify-center">
                    <img src={preview} alt="Partner logo" className="max-h-16 w-auto object-contain" />
                </div>
            )}

            <input ref={inputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

            <button onClick={() => inputRef.current?.click()} disabled={isPending}
                className="w-full py-2.5 rounded-full text-xs font-bold border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all disabled:opacity-40">
                {isPending ? 'Uploading...' : saved ? 'Saved ✓' : preview ? 'Change Logo' : 'Upload Logo'}
            </button>
            <p className="text-[10px] text-white/20 text-center mt-2">JPG, PNG, SVG — max 5 MB</p>
            {error && <p className="text-xs text-[#C96A4A] mt-2 text-center">{error}</p>}
        </div>
    )
}


function isValidHex(v: string) { return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) }
function expandHex(v: string) { if (/^#[0-9a-fA-F]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`; return v }

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const [hex, setHex] = useState(value)
    useEffect(() => { setHex(value) }, [value])
    return (
        <div className="flex items-center gap-2">
            <input type="color" value={isValidHex(hex) ? hex : '#000000'}
                onChange={e => { setHex(e.target.value); onChange(e.target.value) }}
                className="w-9 h-9 rounded-lg border border-white/15 cursor-pointer p-0.5 bg-transparent shrink-0" />
            <input type="text" value={hex} maxLength={7} placeholder="#000000"
                onChange={e => { const v = e.target.value; setHex(v); if (isValidHex(v)) onChange(expandHex(v)) }}
                className="w-24 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-[11px] placeholder-white/15 focus:outline-none focus:border-white/30 font-mono uppercase" />
        </div>
    )
}

function ProgramUIPreview({ branding }: { branding: BrandingColors }) {
    const { phases, gates, totalDays, programName } = getEffectiveProgram(branding)
    const firstPhase = phases[0]
    const firstCfg = getPhaseColorConfig(branding, firstPhase.key)
    const mixC = getPhaseTextColor(firstCfg, firstPhase.key)
    const barStops = phases.map(ph => {
        const cfg = getPhaseColorConfig(branding, ph.key)
        return `${getPhaseBarColor(cfg, ph.key)} ${Math.round((ph.startDay / totalDays) * 100)}%`
    }).join(', ')
    return (
        <div className="rounded-2xl bg-[#1a2634] p-4 overflow-hidden relative" style={{ border: `1px solid ${branding.cardBorderColor || 'rgba(255,255,255,0.08)'}` }}>
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-[50px] -translate-y-1/2 translate-x-1/2 pointer-events-none" style={{ backgroundColor: `${mixC}20` }} />
            <div className="absolute top-0 left-0 w-full h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${mixC}50, transparent)` }} />
            <div className="relative">
                <div className="flex items-center justify-between mb-2.5">
                    <div>
                        <p className="text-[10px] font-bold text-white">{programName}</p>
                        <p className="text-[9px] text-white/30">Week 1 · {totalDays - 1} days remaining</p>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-base font-black" style={{ color: mixC }}>Day 1</span>
                        <span className="text-white/25 text-[10px]">/ {totalDays}</span>
                    </div>
                </div>
                <div className="grid gap-0.5 mb-1.5" style={{ gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))` }}>
                    {phases.map((ph, i) => {
                        const cfg = getPhaseColorConfig(branding, ph.key)
                        const c = getPhaseTextColor(cfg, ph.key)
                        const bg = getPhaseBackground(cfg, ph.key)
                        const isGrad = cfg?.type === 'gradient'
                        return (
                            <div key={ph.key} className="text-center">
                                {i === 0 && isGrad ? (
                                    <span className="text-[8px] font-bold tracking-widest uppercase"
                                        style={{ background: bg, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', display: 'inline-block' }}>
                                        {ph.label}
                                    </span>
                                ) : (
                                    <div className="text-[8px] font-bold tracking-widest uppercase"
                                        style={{ color: i === 0 ? c : 'rgba(255,255,255,0.18)' }}>
                                        {ph.label}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
                <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
                    <div className="h-full w-[2%] rounded-full" style={{ background: `linear-gradient(90deg, ${barStops})` }} />
                    {gates.map(g => <div key={g.day} className="absolute top-0 bottom-0 w-px bg-white/15" style={{ left: `${(g.day / totalDays) * 100}%` }} />)}
                </div>
                <div className="flex gap-1">
                    {gates.map(g => (
                        <div key={g.day} className="flex-1 flex items-center gap-1 rounded-lg border border-white/8 px-1.5 py-1">
                            <div className="w-2.5 h-2.5 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                                <div className="w-1 h-1 rounded-full bg-white/20" />
                            </div>
                            <span className="text-[7px] text-white/25">Day {g.day}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

function PhaseEditor({ phaseKey, config, onChange }: {
    phaseKey: string
    config: PhaseColorConfig
    onChange: (cfg: PhaseColorConfig) => void
}) {
    const def = DEFAULT_PHASE_COLORS[phaseKey] ?? '#2CB1A1'
    const type = config.type || 'solid'
    const solidColor = config.color || def
    const fromColor = config.from || def
    const toColor = config.to || def
    const angle = config.angle ?? 135

    const previewBg = type === 'gradient'
        ? `linear-gradient(${angle}deg, ${fromColor}, ${toColor})`
        : solidColor

    const isDefault = type === 'solid' && solidColor === def

    return (
        <div className="space-y-3">
            {/* Solid / Gradient toggle + reset */}
            <div className="flex gap-2 items-center">
                {(['solid', 'gradient'] as const).map(t => (
                    <button key={t} type="button" onClick={() => onChange({ ...config, type: t })}
                        className="px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all"
                        style={{
                            borderColor: type === t ? `${solidColor}60` : 'rgba(255,255,255,0.08)',
                            color: type === t ? 'white' : 'rgba(255,255,255,0.35)',
                            backgroundColor: type === t ? `${solidColor}15` : 'transparent',
                        }}>
                        {t === 'solid' ? 'Solid' : 'Gradient'}
                    </button>
                ))}
                {/* Reset to default */}
                {!isDefault && (
                    <button type="button" onClick={() => onChange({ type: 'solid', color: def })}
                        className="text-[10px] text-white/25 hover:text-white/60 transition-colors ml-1 underline">
                        Reset
                    </button>
                )}
                {/* Preview swatch */}
                <div className="ml-auto w-8 h-8 rounded-lg border border-white/10 shrink-0" style={{ background: previewBg }} />
            </div>

            {type === 'solid' ? (
                <ColorInput value={solidColor} onChange={v => onChange({ ...config, type: 'solid', color: v })} />
            ) : (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40 w-10 shrink-0">From</span>
                        <ColorInput value={fromColor} onChange={v => onChange({ ...config, type: 'gradient', from: v, to: toColor, angle })} />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40 w-10 shrink-0">To</span>
                        <ColorInput value={toColor} onChange={v => onChange({ ...config, type: 'gradient', from: fromColor, to: v, angle })} />
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] text-white/40 w-10 shrink-0">Angle</span>
                        <input type="range" min={0} max={360} value={angle}
                            onChange={e => onChange({ ...config, type: 'gradient', from: fromColor, to: toColor, angle: Number(e.target.value) })}
                            className="flex-1 accent-white/50 h-1" />
                        <span className="text-[10px] text-white/40 w-8 text-right font-mono">{angle}°</span>
                    </div>
                </div>
            )}
        </div>
    )
}

function BrandingColorsPanel({ currentBranding }: { currentBranding?: BrandingColors | null }) {
    const [branding, setBranding] = useState<BrandingColors>(() => normaliseBranding(currentBranding ?? null))
    const [tab, setTab] = useState<'colors' | 'structure'>('colors')
    const [activePhaseKey, setActivePhaseKey] = useState<string>('mix')
    const [isPending, startTransition] = useTransition()
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const { phases, gates, totalDays, programName } = getEffectiveProgram(branding)

    function setPhaseColor(key: string, cfg: PhaseColorConfig) {
        setBranding(prev => {
            const { phases: prevPhases } = getEffectiveProgram(prev)
            const newPhases = prevPhases.map(p => p.key === key ? { ...p, color: cfg } : p)
            return { ...prev, program: { ...(prev.program ?? {}), phases: newPhases } }
        })
    }

    function setDayCounterColor(cfg: PhaseColorConfig) {
        setBranding(prev => ({ ...prev, dayCounter: cfg }))
    }

    function setTotalDays(n: number) {
        setBranding(prev => ({ ...prev, program: { ...(prev.program ?? {}), totalDays: n } }))
    }

    function setProgramName(name: string) {
        setBranding(prev => ({ ...prev, program: { ...(prev.program ?? {}), programName: name } }))
    }

    function updatePhase(idx: number, update: Partial<ProgramPhase>) {
        setBranding(prev => {
            const { phases: prevPhases } = getEffectiveProgram(prev)
            const newPhases = prevPhases.map((p, i) => i === idx ? { ...p, ...update } : p)
            return { ...prev, program: { ...(prev.program ?? {}), phases: newPhases } }
        })
    }

    function addPhase() {
        setBranding(prev => {
            const { phases: prevPhases } = getEffectiveProgram(prev)
            const lastEnd = prevPhases[prevPhases.length - 1]?.endDay ?? 0
            const newEnd = lastEnd + 20
            const newPhase: ProgramPhase = {
                key: `phase_${Date.now()}`,
                label: 'NEW',
                subtitle: '',
                startDay: lastEnd + 1,
                endDay: newEnd,
            }
            return { ...prev, program: { ...(prev.program ?? {}), phases: [...prevPhases, newPhase] } }
        })
    }

    function removePhase(idx: number) {
        setBranding(prev => {
            const { phases: prevPhases } = getEffectiveProgram(prev)
            if (prevPhases.length <= 1) return prev
            const newPhases = prevPhases.filter((_, i) => i !== idx)
            return { ...prev, program: { ...(prev.program ?? {}), phases: newPhases } }
        })
    }

    function updateGate(idx: number, update: Partial<ProgramGate>) {
        setBranding(prev => {
            const { gates: prevGates } = getEffectiveProgram(prev)
            const newGates = prevGates.map((g, i) => i === idx ? { ...g, ...update } : g)
            return { ...prev, program: { ...(prev.program ?? {}), gates: newGates } }
        })
    }

    function addGate() {
        setBranding(prev => {
            const { gates: prevGates } = getEffectiveProgram(prev)
            const maxDay = prevGates[prevGates.length - 1]?.day ?? 0
            const newGate: ProgramGate = { day: maxDay + 10, label: `Day ${maxDay + 10}` }
            return { ...prev, program: { ...(prev.program ?? {}), gates: [...prevGates, newGate] } }
        })
    }

    function removeGate(idx: number) {
        setBranding(prev => {
            const { gates: prevGates } = getEffectiveProgram(prev)
            const newGates = prevGates.filter((_, i) => i !== idx)
            return { ...prev, program: { ...(prev.program ?? {}), gates: newGates } }
        })
    }

    function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        startTransition(async () => {
            const result = await updatePartnerBrandingColors(branding)
            if ('error' in result) setError(result.error)
            else { setSaved(true); setTimeout(() => setSaved(false), 3000) }
        })
    }

    const activePhase = phases.find(p => p.key === activePhaseKey) ?? phases[0]
    const activeColorCfg = getPhaseColorConfig(branding, activePhase.key) ?? { type: 'solid' as const, color: DEFAULT_PHASE_COLORS[activePhase.key] ?? '#2CB1A1' }
    const firstCfg = getPhaseColorConfig(branding, phases[0]?.key ?? 'mix')
    const headerBg = getPhaseBackground(firstCfg, phases[0]?.key ?? 'mix')

    return (
        <div className="rounded-3xl border border-white/8 bg-[#203e5f]/60 p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center border border-white/10 transition-colors" style={{ background: headerBg }}>
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-sm font-bold text-white">Program Branding</h3>
                    <p className="text-[10px] text-white/30">Customize 100 Days UI for your founders</p>
                </div>
            </div>

            {/* Top-level tab: Colors | Structure */}
            <div className="flex gap-1 mb-5 p-1 rounded-2xl bg-white/4 border border-white/6">
                {(['colors', 'structure'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setTab(t)}
                        className="flex-1 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                        style={{
                            background: tab === t ? 'rgba(255,255,255,0.08)' : 'transparent',
                            color: tab === t ? 'white' : 'rgba(255,255,255,0.3)',
                        }}>
                        {t === 'colors' ? 'Colors' : 'Structure'}
                    </button>
                ))}
            </div>

            <form onSubmit={handleSave}>
                {tab === 'colors' && (
                    <div className="space-y-4">
                        {/* Phase tab selector */}
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Phase Colors</p>
                            <div className="flex flex-wrap gap-1 mb-3 p-1 rounded-2xl bg-white/4 border border-white/6">
                                {phases.map(ph => {
                                    const cfg = getPhaseColorConfig(branding, ph.key)
                                    const bg = getPhaseBackground(cfg, ph.key)
                                    const isActive = activePhase.key === ph.key
                                    return (
                                        <button key={ph.key} type="button" onClick={() => setActivePhaseKey(ph.key)}
                                            className="flex-1 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all min-w-0"
                                            style={{
                                                background: isActive ? bg : 'transparent',
                                                color: isActive ? 'white' : 'rgba(255,255,255,0.3)',
                                            }}>
                                            {ph.label}
                                        </button>
                                    )
                                })}
                            </div>
                            <PhaseEditor phaseKey={activePhase.key} config={activeColorCfg} onChange={cfg => setPhaseColor(activePhase.key, cfg)} />
                        </div>

                        {/* Day counter color */}
                        <div className="border-t border-white/5 pt-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Day Counter Color</p>
                            <PhaseEditor
                                phaseKey="mix"
                                config={branding.dayCounter ?? { type: 'solid', color: '#ffffff' }}
                                onChange={setDayCounterColor}
                            />
                        </div>

                        {/* Card border color */}
                        <div className="border-t border-white/5 pt-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Card Border Color</p>
                            <ColorInput
                                value={branding.cardBorderColor || '#1a1a1f'}
                                onChange={v => setBranding(prev => ({ ...prev, cardBorderColor: v }))}
                            />
                        </div>
                    </div>
                )}

                {tab === 'structure' && (
                    <div className="space-y-5">
                        {/* Program metadata */}
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 block mb-1.5">Program Name</label>
                                <input
                                    type="text" value={programName}
                                    onChange={e => setProgramName(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-white/25"
                                    placeholder="100 Days Program"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 block mb-1.5">Total Days</label>
                                <input
                                    type="number" min={1} max={999} value={totalDays}
                                    onChange={e => setTotalDays(Number(e.target.value))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-white/25 font-mono"
                                />
                            </div>
                        </div>

                        {/* Phases */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Phases</p>
                                <button type="button" onClick={addPhase}
                                    className="text-[10px] text-white/30 hover:text-white/70 transition-colors border border-white/10 hover:border-white/20 px-2.5 py-1 rounded-full">
                                    + Add
                                </button>
                            </div>
                            <div className="space-y-2">
                                {phases.map((ph, idx) => (
                                    <div key={ph.key} className="rounded-xl border border-white/8 bg-white/3 p-3 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <input
                                                type="text" value={ph.label}
                                                onChange={e => updatePhase(idx, { label: e.target.value.toUpperCase() })}
                                                className="flex-1 bg-transparent border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-white/25 min-w-0"
                                                placeholder="LABEL"
                                            />
                                            {phases.length > 1 && (
                                                <button type="button" onClick={() => removePhase(idx)}
                                                    className="text-white/20 hover:text-[#C96A4A] transition-colors shrink-0 text-xs">✕</button>
                                            )}
                                        </div>
                                        <input
                                            type="text" value={ph.subtitle ?? ''}
                                            onChange={e => updatePhase(idx, { subtitle: e.target.value })}
                                            className="w-full bg-transparent border border-white/8 rounded-lg px-2.5 py-1.5 text-white/50 text-[11px] focus:outline-none focus:border-white/20"
                                            placeholder="Subtitle (optional)"
                                        />
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <span className="text-[9px] text-white/25 block mb-1">Start Day</span>
                                                <input type="number" min={1} value={ph.startDay}
                                                    onChange={e => updatePhase(idx, { startDay: Number(e.target.value) })}
                                                    className="w-full bg-transparent border border-white/8 rounded-lg px-2.5 py-1 text-white text-xs font-mono focus:outline-none focus:border-white/20" />
                                            </div>
                                            <div className="flex-1">
                                                <span className="text-[9px] text-white/25 block mb-1">End Day</span>
                                                <input type="number" min={1} value={ph.endDay}
                                                    onChange={e => updatePhase(idx, { endDay: Number(e.target.value) })}
                                                    className="w-full bg-transparent border border-white/8 rounded-lg px-2.5 py-1 text-white text-xs font-mono focus:outline-none focus:border-white/20" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Gates */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Decision Gates</p>
                                <button type="button" onClick={addGate}
                                    className="text-[10px] text-white/30 hover:text-white/70 transition-colors border border-white/10 hover:border-white/20 px-2.5 py-1 rounded-full">
                                    + Add
                                </button>
                            </div>
                            <div className="space-y-2">
                                {gates.map((g, idx) => (
                                    <div key={idx} className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/3 px-3 py-2">
                                        <input type="number" min={1} value={g.day}
                                            onChange={e => updateGate(idx, { day: Number(e.target.value) })}
                                            className="w-16 bg-transparent border border-white/10 rounded-lg px-2 py-1 text-white text-xs font-mono focus:outline-none focus:border-white/25 shrink-0 text-center" />
                                        <input type="text" value={g.label}
                                            onChange={e => updateGate(idx, { label: e.target.value })}
                                            className="flex-1 bg-transparent border border-white/8 rounded-lg px-2.5 py-1 text-white/70 text-[11px] focus:outline-none focus:border-white/20 min-w-0" />
                                        <button type="button" onClick={() => removeGate(idx)}
                                            className="text-white/20 hover:text-[#C96A4A] transition-colors shrink-0 text-xs">✕</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {error && <p className="text-xs text-[#C96A4A] mt-3">{error}</p>}
                <div className="flex gap-2 mt-4">
                    <button type="submit" disabled={isPending}
                        className="flex-1 py-2 rounded-full text-xs font-bold border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all disabled:opacity-40">
                        {isPending ? 'Saving...' : saved ? 'Saved ✓' : 'Save'}
                    </button>
                    <button type="button" disabled={isPending} onClick={() => { setBranding(normaliseBranding(null)); setSaved(false) }}
                        className="px-4 py-2 rounded-full text-[11px] font-bold border border-white/8 text-white/30 hover:text-white/60 hover:border-white/15 transition-all disabled:opacity-40">
                        Reset all
                    </button>
                </div>
            </form>

            {/* Live preview */}
            <div className="mt-5 border-t border-white/5 pt-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/20 mb-3">Preview</p>
                <ProgramUIPreview branding={branding} />
            </div>
        </div>
    )
}

/* ─── Personality scores display ─────────────────────────────────────────── */

function ScoreBar({ label, value, max, hexColor = '#ffcc00' }: {
    label: string; value: number; max: number; hexColor?: string
}) {
    return (
        <div className="flex items-center gap-3">
            <span className="text-xs text-white/40 w-28 shrink-0 truncate">{label}</span>
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, (value / max) * 100)}%`, backgroundColor: hexColor, boxShadow: `0 0 8px ${hexColor}50` }} />
            </div>
            <span className="text-xs font-bold text-white/40 w-12 text-right tabular-nums">{value.toFixed(2)}</span>
        </div>
    )
}

function PersonalityPanel({ founder, settings }: { founder: PartnerFounder; settings: any }) {
    const scores = founder.personalityScores
    if (!scores) return <p className="text-white/25 text-xs">No personality test completed yet.</p>

    const p = settings?.personality ?? {}
    const tl = p.traitLabels ?? {}
    const cl = p.compositeLabels ?? {}
    const fl = p.flagLabels ?? {}
    const tn = p.trackNames ?? {}
    const r = p.results ?? {}

    // Resolve archetype metadata
    const archetypeKey = normalizeArchetypeKey(scores.archetype)
    const payloadArchetypes = buildNormalizedArchetypeMap(p.archetypes)
    const pMeta = payloadArchetypes[archetypeKey] ?? {}
    const displayStrengths: string[] = pMeta.strengths?.map((s: any) => s.text).filter(Boolean) ?? []
    const displayBlindSpots: string[] = pMeta.blindSpots?.map((s: any) => s.text).filter(Boolean) ?? []
    const displayBestRole: string = pMeta.bestRole ?? ''
    const displayEmoji: string = pMeta.emoji || scores.archetypeEmoji
    const displayTagline: string = pMeta.tagline || scores.archetypeTagline

    const trackDisplayMap: Record<string, string> = {
        'Operator Track': tn.operatorTrack || 'Operator Track',
        'Explorer Track': tn.explorerTrack || 'Explorer Track',
        'Support Track': tn.supportTrack || 'Support Track',
        'Starter Track': tn.starterTrack || 'Starter Track',
    }
    const displayTrack = trackDisplayMap[scores.track] ?? scores.track

    const traitColors: Record<string, string> = {
        E: '#E8A838', A: '#38C9E8', C: '#38E87A', N: '#E85B38', O: '#B038E8', SE: '#38E8C9', RT: '#E83870',
    }
    const compositeColors: Record<string, string> = {
        ES: '#38E87A', EXEC: '#3888E8', ADAPT: '#B038E8', RISK_CAL: '#E8A838',
    }
    const traitLabels: Record<string, string> = {
        E: tl.E || 'Extraversion', A: tl.A || 'Agreeableness', C: tl.C || 'Conscientiousness',
        N: tl.N || 'Neuroticism', O: tl.O || 'Openness', SE: tl.SE || 'Self-Efficacy', RT: tl.RT || 'Risk-Taking',
    }
    const compositeLabels: Record<string, string> = {
        ES: cl.ES || 'Emotional Stability', EXEC: cl.EXEC || 'Execution',
        ADAPT: cl.ADAPT || 'Adaptability', RISK_CAL: cl.RISK_CAL || 'Risk Calibration',
    }

    const raw: Record<string, number> = typeof scores.raw === 'object' && scores.raw ? scores.raw : {}
    const composite: Record<string, number> = typeof scores.composite === 'object' && scores.composite ? scores.composite : {}
    const flags: Record<string, boolean> = typeof scores.flags === 'object' && scores.flags ? scores.flags : {}

    const rawEntries = Object.entries(raw).filter(([, v]) => typeof v === 'number') as [string, number][]
    const compEntries = Object.entries(composite).filter(([, v]) => typeof v === 'number') as [string, number][]

    return (
        <div className="space-y-4">
            {/* Archetype card */}
            {founder.archetype && (
                <div className="rounded-2xl border border-white/8 bg-white/3 p-4 text-center space-y-1">
                    {displayEmoji && <div className="text-4xl">{displayEmoji}</div>}
                    <p className="text-sm font-bold text-[#ffcc00]">{normalizeArchetypeKey(founder.archetype)}</p>
                    {displayTagline && <p className="text-xs text-white/40 italic">{displayTagline}</p>}
                    {displayTrack && (
                        <span className="inline-block mt-1 px-3 py-1 rounded-full bg-[#ffcc00]/10 border border-[#ffcc00]/20 text-xs font-bold text-[#ffcc00]">
                            {displayTrack}
                        </span>
                    )}
                </div>
            )}

            {/* Strengths */}
            {displayStrengths.length > 0 && (
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/20 mb-2">{r.coreStrengthsLabel || 'Core Strengths'}</p>
                    <div className="space-y-1">
                        {displayStrengths.map((s, i) => (
                            <div key={i} className="flex gap-2 text-xs text-white/60">
                                <span className="text-[#38E87A] shrink-0">✦</span>
                                <span>{s}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Blind spots */}
            {displayBlindSpots.length > 0 && (
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/20 mb-2">{r.blindSpotsLabel || 'Blind Spots'}</p>
                    <div className="space-y-1">
                        {displayBlindSpots.map((s, i) => (
                            <div key={i} className="flex gap-2 text-xs text-white/60">
                                <span className="text-[#E8A838] shrink-0">⚠</span>
                                <span>{s}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Best role */}
            {displayBestRole && (
                <div className="rounded-xl border border-white/6 bg-white/3 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/20 mb-1">{r.bestTeamRoleLabel || 'Best Team Role'}</p>
                    <p className="text-xs text-white/70 font-semibold">{displayBestRole}</p>
                </div>
            )}

            {/* Raw traits */}
            {rawEntries.length > 0 && (
                <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/20 mb-2">{r.personalityTraitsLabel || 'Personality Traits'}</p>
                    {rawEntries.map(([k, v]) => (
                        <ScoreBar key={k} label={traitLabels[k] || k} value={v} max={5} hexColor={traitColors[k] || '#ffcc00'} />
                    ))}
                </div>
            )}

            {/* Composite scores */}
            {compEntries.length > 0 && (
                <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/20 mb-2">{r.compositeScoresLabel || 'Composite Scores'}</p>
                    {compEntries.map(([k, v]) => (
                        <ScoreBar key={k} label={compositeLabels[k] || k} value={v} max={5} hexColor={compositeColors[k] || '#a855f7'} />
                    ))}
                </div>
            )}

            {/* Flags */}
            {(flags.low_ES || flags.low_exec || flags.high_risk || flags.low_risk) && (
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#C96A4A]/60 mb-2">{r.flagsLabel || 'Flags'}</p>
                    <div className="flex flex-wrap gap-1.5">
                        {flags.low_ES && <span className="px-2 py-1 rounded-lg bg-[#C96A4A]/10 border border-[#C96A4A]/20 text-[10px] font-bold text-[#C96A4A]">{fl.lowES || 'Low Emotional Stability'}</span>}
                        {flags.low_exec && <span className="px-2 py-1 rounded-lg bg-[#C96A4A]/10 border border-[#C96A4A]/20 text-[10px] font-bold text-[#C96A4A]">{fl.lowExec || 'Low Execution'}</span>}
                        {flags.high_risk && <span className="px-2 py-1 rounded-lg bg-[#C96A4A]/10 border border-[#C96A4A]/20 text-[10px] font-bold text-[#C96A4A]">{fl.highRisk || 'High Risk Appetite'}</span>}
                        {flags.low_risk && <span className="px-2 py-1 rounded-lg bg-[#C96A4A]/10 border border-[#C96A4A]/20 text-[10px] font-bold text-[#C96A4A]">{fl.lowRisk || 'Low Risk Appetite'}</span>}
                    </div>
                </div>
            )}
        </div>
    )
}

/* ─── Founders tab ───────────────────────────────────────────────────────── */

function formatIntakeAnswer(value: unknown, question: FormQuestion): string {
    if (value === null || value === undefined || value === '') return '—'
    if (question.question_type === 'yes_no') {
        if (value === true || value === 'true' || value === 'yes' || value === 'Yes') return 'Yes'
        if (value === false || value === 'false' || value === 'no' || value === 'No') return 'No'
    }
    if (question.question_type === 'multiple_choice_multiple' && Array.isArray(value)) {
        return value.map((v: any) => {
            const ch = question.choices?.find(c => c.value === v)
            return ch ? ch.label : String(v)
        }).join(', ')
    }
    if ((question.question_type === 'multiple_choice_single' || question.question_type === 'dropdown') && question.choices) {
        const ch = question.choices.find(c => c.value === value)
        if (ch) return ch.label
    }
    return String(value)
}

function FoundersTab({ founders, settings }: { founders: PartnerFounder[]; settings: any }) {
    const [selected, setSelected] = useState<PartnerFounder | null>(null)
    const [search, setSearch] = useState('')

    const filtered = founders.filter(f => f.email.toLowerCase().includes(search.toLowerCase()))

    const progStatus = (s: string) => PROG_STATUS_COLORS[s] ?? PROG_STATUS_COLORS.not_started

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* List */}
            <div className="lg:col-span-1 space-y-3">
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search by email..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/20 transition-all" />

                {filtered.length === 0 ? (
                    <p className="text-white/25 text-sm text-center py-8">No founders found.</p>
                ) : (
                    <div className="space-y-2">
                        {filtered.map(f => {
                            const ps = progStatus(f.programStatus)
                            const isSelected = selected?.id === f.id
                            return (
                                <button key={f.id} onClick={() => setSelected(isSelected ? null : f)}
                                    className="w-full text-left rounded-2xl border p-4 transition-all hover:border-white/20"
                                    style={{
                                        borderColor: isSelected ? '#ffcc0050' : 'rgba(255,255,255,0.08)',
                                        backgroundColor: isSelected ? '#ffcc0008' : 'rgba(20,20,22,0.6)',
                                    }}>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-xs font-medium text-white/80 truncate">{f.email}</p>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                {f.archetype && (
                                                    <span className="text-[10px] text-[#ffcc00]">{f.archetypeEmoji} {f.archetype}</span>
                                                )}
                                                {f.track && <span className="text-[10px] text-white/25">· {f.track}</span>}
                                            </div>
                                        </div>
                                        <div className="shrink-0 flex flex-col items-end gap-1">
                                            <span className="text-[10px] font-bold uppercase" style={{ color: ps.color }}>{ps.label}</span>
                                            {f.projectSubmission && (
                                                <StatusBadge status={f.projectSubmission.status as any} />
                                            )}
                                        </div>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Detail panel */}
            <div className="lg:col-span-2">
                {selected ? (
                    <div className="rounded-3xl border border-white/10 bg-[#203e5f]/60 p-6 space-y-6 sticky top-6">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-base font-bold text-white">{selected.email}</h3>
                                <p className="text-xs text-white/30 mt-0.5">
                                    Joined {new Date(selected.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                            </div>
                            <button onClick={() => setSelected(null)} className="text-white/25 hover:text-white/50 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Program stats */}
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Program</p>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: 'Status', value: PROG_STATUS_COLORS[selected.programStatus]?.label ?? selected.programStatus, color: PROG_STATUS_COLORS[selected.programStatus]?.color ?? 'white' },
                                    { label: 'Attempts', value: `${selected.programAttempts} / 3`, color: 'white' },
                                    { label: 'Payment', value: selected.hasPaid100Days ? 'Paid' : 'Not paid', color: selected.hasPaid100Days ? '#2CB1A1' : 'rgba(255,255,255,0.3)' },
                                ].map(s => (
                                    <div key={s.label} className="rounded-xl bg-white/4 border border-white/6 px-3 py-3 text-center">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/25 mb-1">{s.label}</p>
                                        <p className="text-sm font-bold" style={{ color: s.color }}>{s.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Project submission */}
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Project Application</p>
                            {selected.projectSubmission ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <StatusBadge status={selected.projectSubmission.status as any} />
                                        {selected.projectSubmission.track && (
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#ffcc00] bg-[#ffcc00]/10 border border-[#ffcc00]/20 rounded-full px-2.5 py-0.5">
                                                {typeof selected.projectSubmission.track === 'object' ? selected.projectSubmission.track.name : selected.projectSubmission.track}
                                            </span>
                                        )}
                                    </div>
                                    {selected.projectSubmission.projectDescription && (
                                        <div className="rounded-xl border border-white/8 bg-white/3 p-4 max-h-48 overflow-y-auto">
                                            <p className="text-xs text-white/65 leading-relaxed whitespace-pre-wrap">{selected.projectSubmission.projectDescription}</p>
                                        </div>
                                    )}
                                    {selected.projectSubmission.partnerComment && (
                                        <p className="text-xs text-white/40 italic">{selected.projectSubmission.partnerComment}</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs text-white/25">No project submission yet.</p>
                            )}
                        </div>

                        {/* Intake form */}
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">
                                Intake Form{selected.intakeSubmission?.formTitle ? ` — ${selected.intakeSubmission.formTitle}` : ''}
                            </p>
                            {selected.intakeSubmission?.submissionData ? (() => {
                                const data = selected.intakeSubmission!.submissionData as Record<string, any>
                                const sections = selected.intakeSubmission!.formSections
                                // Build a flat ordered list of [question_text, answer] pairs from form sections if available
                                if (sections && sections.length > 0) {
                                    const pairs: { label: string; answer: string }[] = []
                                    for (const sec of sections) {
                                        for (const q of sec.questions ?? []) {
                                            if (q.question_id in data) {
                                                pairs.push({ label: q.question_text, answer: formatIntakeAnswer(data[q.question_id], q) })
                                            }
                                        }
                                    }
                                    // Any extra keys not mapped by form definition
                                    const mappedIds = new Set(sections.flatMap(s => s.questions?.map(q => q.question_id) ?? []))
                                    for (const [k, v] of Object.entries(data)) {
                                        if (!mappedIds.has(k)) pairs.push({ label: k.replace(/_/g, ' '), answer: String(v) })
                                    }
                                    return (
                                        <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-3 max-h-64 overflow-y-auto">
                                            {pairs.map(({ label, answer }, i) => {
                                                const answerIsLink = answer.startsWith('http://') || answer.startsWith('https://')
                                                return (
                                                    <div key={i}>
                                                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-0.5">{label}</p>
                                                        {answerIsLink ? (
                                                            <a href={answer} target="_blank" rel="noopener noreferrer" className="text-xs text-[#ffcc00] underline break-all">{answer.split('/').pop() || answer}</a>
                                                        ) : (
                                                            <p className="text-xs text-white/65 leading-relaxed">{answer}</p>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )
                                }
                                // Fallback: raw key-value
                                return (
                                    <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-2 max-h-64 overflow-y-auto">
                                        {Object.entries(data).map(([k, v]) => {
                                            const vStr = String(v)
                                            const vIsLink = vStr.startsWith('http://') || vStr.startsWith('https://')
                                            return (
                                            <div key={k}>
                                                <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-0.5">{k.replace(/_/g, ' ')}</p>
                                                {vIsLink ? (
                                                    <a href={vStr} target="_blank" rel="noopener noreferrer" className="text-xs text-[#ffcc00] underline break-all">{vStr.split('/').pop() || vStr}</a>
                                                ) : (
                                                    <p className="text-xs text-white/65 leading-relaxed">{vStr}</p>
                                                )}
                                            </div>
                                            )
                                        })}
                                    </div>
                                )
                            })() : (
                                <p className="text-white/25 text-xs">No intake form submitted yet.</p>
                            )}
                        </div>

                        {/* Personality results */}
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Personality Assessment</p>
                            <PersonalityPanel founder={selected} settings={settings} />
                        </div>

                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Daily Progress</p>
                            <FounderProgressPanel
                                founderEmail={selected.email}
                                timeline={selected.progressTimeline ?? null}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="rounded-3xl border border-white/6 bg-[#203e5f]/30 p-12 flex items-center justify-center text-center">
                        <div>
                            <div className="w-12 h-12 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center mx-auto mb-4">
                                <svg className="w-6 h-6 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                                </svg>
                            </div>
                            <p className="text-white/25 text-sm">Select a founder to view their details</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

/* ─── Applications tab ───────────────────────────────────────────────────── */

const ARCHETYPE_OPTIONS = CANONICAL_ARCHETYPES.map((archetype) => archetype.key)

const PROGRAM_STATUS_OPTIONS = [
    { value: 'not_started', label: 'Not started' },
    { value: 'active', label: 'Active' },
    { value: 'failed', label: 'Failed' },
    { value: 'completed', label: 'Completed' },
]

const SUBMISSION_STATUS_OPTIONS = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'denied', label: 'Denied' },
]

function ExcelExportImportPanel({ isAdmin, partnerRecord, allPartners, allTracks, founders, selectedUserIds, onToggleUser, onSelectAll, onDeselectAll }: {
    isAdmin: boolean
    partnerRecord: any
    allPartners: { id: number; name: string; slug: string }[]
    allTracks: { id: number; name: string; slug: string }[]
    founders: PartnerFounder[]
    selectedUserIds: Set<number>
    onToggleUser: (id: number) => void
    onSelectAll: () => void
    onDeselectAll: () => void
}) {
    const router = useRouter()
    const [exportPartnerId, setExportPartnerId] = useState<string>(
        isAdmin ? (allPartners[0]?.id?.toString() ?? '') : (partnerRecord?.id?.toString() ?? '')
    )
    const [exportTrack, setExportTrack] = useState<string>('all')
    const [exportArchetype, setExportArchetype] = useState<string>('all')
    const [exportProgramStatus, setExportProgramStatus] = useState<string>('all')
    const [exportSubStatus, setExportSubStatus] = useState<string>('all')
    const [useSelection, setUseSelection] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [importFile, setImportFile] = useState<File | null>(null)
    const [importing, setImporting] = useState(false)
    const [importResult, setImportResult] = useState<{ processed: number; skipped: number; errors: any[]; total: number } | null>(null)
    const [importError, setImportError] = useState<string | null>(null)
    const [exportError, setExportError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    async function handleExport() {
        if (!exportPartnerId && isAdmin) return
        setExporting(true)
        setExportError(null)
        try {
            const params = new URLSearchParams()
            if (isAdmin) params.set('partnerId', exportPartnerId)
            if (exportTrack !== 'all') params.set('track', exportTrack)
            if (isAdmin && exportArchetype !== 'all') params.set('archetype', exportArchetype)
            if (isAdmin && exportProgramStatus !== 'all') params.set('programStatus', exportProgramStatus)
            if (exportSubStatus !== 'all') params.set('submissionStatus', exportSubStatus)
            if (useSelection && selectedUserIds.size > 0) {
                params.set('userIds', Array.from(selectedUserIds).join(','))
            }
            const res = await fetch(`/api/partner-export?${params}`)
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Export failed' }))
                throw new Error(err.error || 'Export failed')
            }
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] || 'export.xlsx'
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
        } catch (err: any) {
            setExportError(err?.message || 'Export failed')
        } finally {
            setExporting(false)
        }
    }

    async function handleImport() {
        if (!importFile) return
        setImporting(true)
        setImportResult(null)
        setImportError(null)
        try {
            const formData = new FormData()
            formData.append('file', importFile)
            const res = await fetch('/api/partner-import', { method: 'POST', body: formData })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Import failed')
            setImportResult(data)
            setImportFile(null)
            if (fileInputRef.current) fileInputRef.current.value = ''
            router.refresh()
        } catch (err: any) {
            setImportError(err?.message || 'Import failed')
        } finally {
            setImporting(false)
        }
    }

    const selectStyle = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-white/20"

    return (
        <div className="rounded-3xl border border-white/8 bg-[#203e5f]/60 p-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-xl bg-[#ffcc00]/10 border border-[#ffcc00]/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-[#ffcc00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-sm font-bold text-white">Excel Export / Import</h3>
                    <p className="text-[10px] text-white/30">Bulk review submissions via spreadsheet</p>
                </div>
            </div>

            {/* Export section */}
            <div className="space-y-3 mb-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Export</p>

                {isAdmin && (
                    <select value={exportPartnerId} onChange={e => setExportPartnerId(e.target.value)} className={selectStyle}>
                        <option value="" disabled>Select partner...</option>
                        {allPartners.map(p => (
                            <option key={p.id} value={p.id} className="bg-[#203e5f] text-white">{p.name}</option>
                        ))}
                    </select>
                )}

                <select value={exportTrack} onChange={e => setExportTrack(e.target.value)} className={selectStyle}>
                    <option value="all" className="bg-[#203e5f] text-white">All tracks</option>
                    {allTracks.map(t => (
                        <option key={t.id} value={t.slug} className="bg-[#203e5f] text-white">{t.name}</option>
                    ))}
                </select>

                {isAdmin && (
                    <>
                        <select value={exportArchetype} onChange={e => setExportArchetype(e.target.value)} className={selectStyle}>
                            <option value="all" className="bg-[#203e5f] text-white">All archetypes</option>
                            {ARCHETYPE_OPTIONS.map(a => (
                                <option key={a} value={a} className="bg-[#203e5f] text-white">{a}</option>
                            ))}
                        </select>

                        <select value={exportProgramStatus} onChange={e => setExportProgramStatus(e.target.value)} className={selectStyle}>
                            <option value="all" className="bg-[#203e5f] text-white">All program statuses</option>
                            {PROGRAM_STATUS_OPTIONS.map(o => (
                                <option key={o.value} value={o.value} className="bg-[#203e5f] text-white">{o.label}</option>
                            ))}
                        </select>
                    </>
                )}

                <select value={exportSubStatus} onChange={e => setExportSubStatus(e.target.value)} className={selectStyle}>
                    <option value="all" className="bg-[#203e5f] text-white">All submission statuses</option>
                    {SUBMISSION_STATUS_OPTIONS.map(o => (
                        <option key={o.value} value={o.value} className="bg-[#203e5f] text-white">{o.label}</option>
                    ))}
                </select>

                {/* Selection toggle (admin) */}
                {isAdmin && founders.length > 0 && (
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={useSelection}
                                onChange={e => setUseSelection(e.target.checked)}
                                className="rounded border-white/20 bg-white/5 text-[#ffcc00] focus:ring-[#ffcc00]/30 w-3.5 h-3.5"
                            />
                            <span className="text-[10px] text-white/40 group-hover:text-white/60 transition-colors">
                                Export only selected users ({selectedUserIds.size} selected)
                            </span>
                        </label>
                        {useSelection && (
                            <div className="flex gap-2">
                                <button onClick={onSelectAll} className="text-[10px] text-[#ffcc00]/60 hover:text-[#ffcc00] transition-colors">
                                    Select all
                                </button>
                                <span className="text-white/10">|</span>
                                <button onClick={onDeselectAll} className="text-[10px] text-white/30 hover:text-white/60 transition-colors">
                                    Deselect all
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {exportError && (
                    <p className="text-xs text-[#C96A4A] bg-[#C96A4A]/10 border border-[#C96A4A]/20 rounded-xl px-3 py-2">{exportError}</p>
                )}

                <button
                    onClick={handleExport}
                    disabled={exporting || (isAdmin && !exportPartnerId) || (useSelection && selectedUserIds.size === 0)}
                    className="w-full py-2.5 rounded-xl font-bold text-xs text-white border border-[#ffcc00]/30 bg-[#ffcc00]/10 hover:bg-[#ffcc00]/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {exporting ? 'Generating...' : useSelection && selectedUserIds.size > 0
                        ? `Download Excel (${selectedUserIds.size} users)`
                        : 'Download Excel (all matching)'}
                </button>
            </div>

            {/* Divider */}
            <div className="border-t border-white/5 my-5" />

            {/* Import section */}
            <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Import Decisions</p>
                <p className="text-[10px] text-white/25 leading-relaxed">Upload the filled Excel file to approve/deny submissions in bulk.</p>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={e => { setImportFile(e.target.files?.[0] ?? null); setImportResult(null); setImportError(null) }}
                    className="w-full text-xs text-white/50 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border file:border-white/10 file:bg-white/5 file:text-white/60 file:text-xs file:font-semibold file:cursor-pointer hover:file:bg-white/10 transition-all"
                />

                {importFile && (
                    <button
                        onClick={handleImport}
                        disabled={importing}
                        className="w-full py-2.5 rounded-xl font-bold text-xs text-[#1a2634] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: 'linear-gradient(135deg,#2CB1A1,#ffcc00)' }}
                    >
                        {importing ? 'Processing...' : `Import ${importFile.name}`}
                    </button>
                )}

                {importResult && (
                    <div className="rounded-xl border border-[#2CB1A1]/20 bg-[#2CB1A1]/8 p-3 space-y-1">
                        <p className="text-xs font-bold text-[#2CB1A1]">Import complete</p>
                        <p className="text-[10px] text-white/50">
                            {importResult.processed} processed · {importResult.skipped} skipped · {importResult.errors.length} errors
                        </p>
                        {importResult.errors.length > 0 && (
                            <div className="mt-2 space-y-1">
                                {importResult.errors.map((e, i) => (
                                    <p key={i} className="text-[10px] text-[#C96A4A]">
                                        ID {e.submissionId}: {e.error}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {importError && !importResult && (
                    <p className="text-xs text-[#C96A4A] bg-[#C96A4A]/10 border border-[#C96A4A]/20 rounded-xl px-3 py-2">{importError}</p>
                )}
            </div>
        </div>
    )
}

function ApplicationsTab({ submissions, isAdmin, partnerRecord, onReview, onBannedWordsSave, allPartners = [], allTracks = [], founders = [] }: {
    submissions: Submission[]
    isAdmin: boolean
    partnerRecord: any
    onReview: (sub: Submission) => void
    onBannedWordsSave: (words: string) => Promise<void>
    allPartners?: { id: number; name: string; slug: string }[]
    allTracks?: { id: number; name: string; slug: string }[]
    founders?: PartnerFounder[]
}) {
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>('all')
    const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set())

    const filtered = filter === 'all' ? submissions : submissions.filter(s => s.status === filter)
    const counts = {
        all: submissions.length,
        pending: submissions.filter(s => s.status === 'pending').length,
        approved: submissions.filter(s => s.status === 'approved').length,
        denied: submissions.filter(s => s.status === 'denied').length,
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
                {/* Filter tabs */}
                <div className="flex gap-2 flex-wrap">
                    {(['all', 'pending', 'approved', 'denied'] as const).map(f => {
                        const active = filter === f
                        const cfg = f === 'all' ? null : STATUS_COLORS[f]
                        return (
                            <button key={f} onClick={() => setFilter(f)}
                                className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border transition-all"
                                style={{
                                    color: active ? (cfg?.color ?? 'white') : 'rgba(255,255,255,0.3)',
                                    backgroundColor: active ? (cfg?.bg ?? 'rgba(255,255,255,0.05)') : 'transparent',
                                    borderColor: active ? (cfg?.border ?? 'rgba(255,255,255,0.15)') : 'rgba(255,255,255,0.06)',
                                }}>
                                {f} ({counts[f]})
                            </button>
                        )
                    })}
                </div>

                {filtered.length === 0 ? (
                    <div className="rounded-3xl border border-white/6 bg-[#203e5f]/40 p-12 text-center">
                        <p className="text-white/25 text-sm">No submissions{filter !== 'all' ? ` with status "${filter}"` : ''}.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map(sub => {
                            const parsed = parseProjectDescription(sub.projectDescription ?? '')
                            const hasStructured = !!(parsed.name || parsed.oneliner)
                            const userId = sub.user?.id
                            const isSelected = userId ? selectedUserIds.has(userId) : false
                            return (
                            <div key={sub.id} className="flex items-start gap-2">
                                {isAdmin && userId && (
                                    <label className="mt-5 shrink-0 flex items-center cursor-pointer" onClick={e => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => setSelectedUserIds(prev => {
                                                const next = new Set(prev)
                                                if (next.has(userId)) next.delete(userId); else next.add(userId)
                                                return next
                                            })}
                                            className="rounded border-white/20 bg-white/5 text-[#ffcc00] focus:ring-[#ffcc00]/30 w-4 h-4"
                                        />
                                    </label>
                                )}
                                <button onClick={() => onReview(sub)} className={`flex-1 text-left rounded-2xl border ${isSelected ? 'border-[#ffcc00]/30 bg-[#ffcc00]/5' : 'border-white/8 bg-[#203e5f]/60'} p-5 hover:border-white/15 hover:bg-[#203e5f]/80 transition-all cursor-pointer group`}>
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        {/* Top row: email + badges */}
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                            <p className="text-[11px] text-white/35 truncate">{sub.user?.email}</p>
                                            {parsed.industry && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/8">{parsed.industry}</span>
                                            )}
                                            {parsed.path && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2CB1A1]/8 text-[#2CB1A1]/70 border border-[#2CB1A1]/15">{parsed.path}</span>
                                            )}
                                            {sub.autoDenied && (
                                                <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#C96A4A]/10 text-[#C96A4A] border border-[#C96A4A]/20">
                                                    AUTO: &ldquo;{sub.bannedWordMatched}&rdquo;
                                                </span>
                                            )}
                                        </div>

                                        {/* Project name */}
                                        {hasStructured ? (
                                            <>
                                                <p className="text-white font-semibold text-sm leading-snug mb-1 truncate">
                                                    {parsed.name ?? 'Unnamed project'}
                                                </p>
                                                {parsed.oneliner && (
                                                    <p className="text-white/55 text-xs leading-relaxed line-clamp-2 mb-1">{parsed.oneliner}</p>
                                                )}
                                                {parsed.problem && (
                                                    <p className="text-white/30 text-[11px] leading-relaxed line-clamp-1">
                                                        <span className="text-white/20 uppercase tracking-wide text-[9px] font-semibold mr-1">Problem</span>
                                                        {parsed.problem}
                                                    </p>
                                                )}
                                            </>
                                        ) : (
                                            <p className="text-white/55 text-sm leading-relaxed line-clamp-3">{sub.projectDescription}</p>
                                        )}

                                        {sub.partnerComment && (
                                            <p className="text-white/25 text-xs mt-2 italic line-clamp-1">&#8220;{sub.partnerComment}&#8221;</p>
                                        )}
                                        <p className="text-white/20 text-[10px] mt-2">
                                            {new Date(sub.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            {sub.reviewedAt && ` · reviewed ${new Date(sub.reviewedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                        <StatusBadge status={sub.status} />
                                    </div>
                                </div>
                            </button>
                            </div>
                        )})}
                    </div>
                )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
                <ExcelExportImportPanel
                    isAdmin={isAdmin}
                    partnerRecord={partnerRecord}
                    allPartners={allPartners}
                    allTracks={allTracks}
                    founders={founders}
                    selectedUserIds={selectedUserIds}
                    onToggleUser={(id) => setSelectedUserIds(prev => {
                        const next = new Set(prev)
                        if (next.has(id)) next.delete(id); else next.add(id)
                        return next
                    })}
                    onSelectAll={() => setSelectedUserIds(new Set(submissions.map(s => s.user?.id).filter(Boolean) as number[]))}
                    onDeselectAll={() => setSelectedUserIds(new Set())}
                />
                {!isAdmin && partnerRecord && (
                    <>
                        <LogoUploadPanel currentLogoUrl={typeof partnerRecord.logo === 'object' ? partnerRecord.logo?.url ?? null : null} />
                        <BrandingColorsPanel currentBranding={partnerRecord.brandingColors ?? null} />
                        <BannedWordsPanel currentWords={partnerRecord.bannedWords ?? ''} onSave={onBannedWordsSave} />
                    </>
                )}
                {isAdmin && (
                    <div className="rounded-3xl border border-white/8 bg-[#203e5f]/60 p-6">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">Stats</p>
                        <div className="space-y-2">
                            {(['pending', 'approved', 'denied'] as const).map(s => (
                                <div key={s} className="flex items-center justify-between">
                                    <span className="text-xs" style={{ color: STATUS_COLORS[s].color }}>{STATUS_COLORS[s].label}</span>
                                    <span className="text-xs font-bold text-white">{counts[s]}</span>
                                </div>
                            ))}
                            <div className="border-t border-white/5 pt-2 mt-2 flex items-center justify-between">
                                <span className="text-xs text-white/30">Total</span>
                                <span className="text-xs font-bold text-white">{counts.all}</span>
                            </div>
                        </div>
                        <a href="/admin/collections/project-submissions"
                            className="mt-4 block text-center text-xs text-white/30 hover:text-white/60 transition-colors underline">
                            Open in Payload Admin →
                        </a>
                    </div>
                )}
            </div>
        </div>
    )
}

/* ─── Decisions tab (partner override) ───────────────────────────────────── */

function DecisionsTab({ pendingAttempts, overrideGrantsRemaining }: { pendingAttempts: PendingAttempt[]; overrideGrantsRemaining: number }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [actioningId, setActioningId] = useState<number | null>(null)

    async function handleDecision(attemptId: number, decision: 'grant' | 'end') {
        const confirmMsg = decision === 'grant'
            ? 'Grant an extra attempt to this founder? They will start fresh with 0 misses.'
            : 'End this founder\'s program process? Their dashboard will be frozen.'
        if (!confirm(confirmMsg)) return

        setActioningId(attemptId)
        startTransition(async () => {
            const result = await submitPartnerDecision(attemptId, decision)
            setActioningId(null)
            if ('error' in result) {
                alert(result.error)
            } else {
                router.refresh()
            }
        })
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
                <p className="text-sm text-white/50">
                    Override grants remaining: <span className="font-bold text-white">{overrideGrantsRemaining}</span>
                </p>
            </div>
            {pendingAttempts.length === 0 ? (
                <p className="text-white/30 text-center py-12">No pending decisions.</p>
            ) : (
                pendingAttempts.map(a => (
                    <div key={a.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="space-y-1">
                                <p className="text-white font-medium">{a.founderEmail}</p>
                                <div className="flex flex-wrap gap-3 text-xs text-white/40">
                                    <span>Attempt #{a.attemptNumber}</span>
                                    <span>Misses: {a.missCount}/3</span>
                                    <span>Day reached: {a.currentDay}</span>
                                    <span>Missed days: {a.missedDays.length > 0 ? a.missedDays.join(', ') : 'none'}</span>
                                    {a.partnerOverrideRequestedAt && (
                                        <span>Requested: {new Date(a.partnerOverrideRequestedAt).toLocaleDateString('en-GB')}</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleDecision(a.id, 'grant')}
                                    disabled={isPending || overrideGrantsRemaining === 0}
                                    className="px-4 py-2 text-sm font-bold rounded-lg bg-[#2CB1A1]/20 text-[#2CB1A1] border border-[#2CB1A1]/30 hover:bg-[#2CB1A1]/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                    title={overrideGrantsRemaining === 0 ? 'No override grants remaining' : ''}
                                >
                                    {actioningId === a.id ? '...' : 'Grant Extra Attempt'}
                                </button>
                                <button
                                    onClick={() => handleDecision(a.id, 'end')}
                                    disabled={isPending}
                                    className="px-4 py-2 text-sm font-bold rounded-lg bg-[#C96A4A]/20 text-[#C96A4A] border border-[#C96A4A]/30 hover:bg-[#C96A4A]/30 transition-all disabled:opacity-30"
                                >
                                    {actioningId === a.id ? '...' : 'End Process'}
                                </button>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    )
}

/* ─── Mentors Tab ────────────────────────────────────────────────────────── */

function MentorsTab() {
    const [mentors, setMentors] = useState<Array<{
        id: number
        userId: number | string | null
        email: string
        partnerId: number | string | null
        title: string
        profileTitle: string
        profileIsActive: boolean
        createdAt: string
    }>>([])
    const [loading, setLoading] = useState(true)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [editingMentorId, setEditingMentorId] = useState<number | null>(null)
    const [draftTitle, setDraftTitle] = useState('')
    const [draftIsActive, setDraftIsActive] = useState(true)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [isPending, startTransition] = useTransition()

    const loadMentors = useCallback(async () => {
        setLoading(true)
        const result = await listMentors()
        if ('mentors' in result) {
            setMentors(result.mentors)
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        void Promise.resolve().then(loadMentors)
    }, [loadMentors])

    const handleCreate = () => {
        setError('')
        setSuccess('')
        startTransition(async () => {
            const result = await createMentor({ email: email.trim(), password })
            if ('error' in result) {
                setError(result.error)
            } else {
                setSuccess(`Mentor ${email} created successfully`)
                setEmail('')
                setPassword('')
                loadMentors()
            }
        })
    }

    const beginEdit = (mentor: typeof mentors[number]) => {
        setEditingMentorId(mentor.id)
        setDraftTitle(mentor.profileTitle || mentor.title || mentor.email)
        setDraftIsActive(mentor.profileIsActive)
        setError('')
        setSuccess('')
    }

    const handleSaveProfile = (mentorId: number) => {
        setError('')
        setSuccess('')
        startTransition(async () => {
            const result = await updateMentorProfile({
                mentorId,
                title: draftTitle,
                isActive: draftIsActive,
            })
            if ('error' in result) {
                setError(result.error)
            } else {
                setSuccess('Mentor profile updated')
                setEditingMentorId(null)
                await loadMentors()
            }
        })
    }

    return (
        <div className="space-y-6">
            {/* Create mentor form */}
            <div className="bg-[#203e5f] border border-white/8 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">Add Mentor</h3>
                <div className="flex flex-col sm:flex-row gap-3">
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="flex-1 bg-[#172433] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/30"
                    />
                    <input
                        type="password"
                        placeholder="Password (min 6 chars)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="flex-1 bg-[#172433] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/30"
                    />
                    <button
                        onClick={handleCreate}
                        disabled={isPending || !email || !password}
                        className="px-6 py-2.5 text-sm font-bold rounded-lg bg-[#ffcc00] text-white hover:bg-[#ffcc00]/80 transition-all disabled:opacity-30"
                    >
                        {isPending ? 'Creating...' : 'Create Mentor'}
                    </button>
                </div>
                {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
                {success && <p className="mt-2 text-sm text-green-400">{success}</p>}
            </div>

            {/* Mentors list */}
            <div className="bg-[#203e5f] border border-white/8 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">
                    Landing mentor names ({mentors.length})
                </h3>
                {loading ? (
                    <p className="text-sm text-white/30">Loading...</p>
                ) : mentors.length === 0 ? (
                    <p className="text-sm text-white/30">No mentors yet. Create one above.</p>
                ) : (
                    <div className="space-y-2">
                        {mentors.map(m => (
                            <div key={m.id} className="p-3 bg-[#172433] border border-white/5 rounded-lg">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-sm text-white font-medium">{m.profileTitle || m.title || m.email}</p>
                                        <p className="text-xs text-white/30">
                                            {m.email}
                                            <span className="mx-2">·</span>
                                            Created {new Date(m.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            {!m.partnerId && <span className="ml-2 text-amber-400/60">(Global — Admin-created)</span>}
                                        </p>
                                    </div>
                                    <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                                        m.profileIsActive
                                            ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                                            : 'border-white/10 bg-white/5 text-white/35'
                                    }`}>
                                        {m.profileIsActive ? 'Active' : 'Hidden'}
                                    </span>
                                </div>

                                {editingMentorId === m.id ? (
                                    <div className="mt-4 space-y-3">
                                        <input
                                            type="text"
                                            value={draftTitle}
                                            onChange={(e) => setDraftTitle(e.target.value)}
                                            placeholder="Mentor display name"
                                            className="w-full rounded-lg border border-white/10 bg-[#1a2634] px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/30"
                                        />
                                        <label className="flex items-center gap-3 text-sm text-white/65">
                                            <input
                                                type="checkbox"
                                                checked={draftIsActive}
                                                onChange={(e) => setDraftIsActive(e.target.checked)}
                                                className="h-4 w-4 accent-[#ffcc00]"
                                            />
                                            Show this mentor profile
                                        </label>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleSaveProfile(m.id)}
                                                disabled={isPending || !draftTitle.trim()}
                                                className="rounded-lg bg-[#ffcc00] px-4 py-2 text-xs font-bold text-white transition-all hover:bg-[#ffcc00]/80 disabled:opacity-30"
                                            >
                                                Save
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setEditingMentorId(null)}
                                                className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold text-white/50 transition-colors hover:border-white/20 hover:text-white"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-3">
                                        <button
                                            type="button"
                                            onClick={() => beginEdit(m)}
                                            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-white/50 transition-colors hover:border-white/20 hover:text-white"
                                        >
                                            Edit profile
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

function ReferralsTab({
    isAdmin,
    partnerRecord,
    allPartners,
    allTracks,
    inviteLinks,
}: {
    isAdmin: boolean
    partnerRecord: any
    allPartners: PartnerOption[]
    allTracks: AvailableTrackOption[]
    inviteLinks: PartnerInviteLink[]
}) {
    const router = useRouter()
    const defaultPartnerId = isAdmin
        ? (allPartners[0]?.id ?? null)
        : (typeof partnerRecord?.id === 'number' ? partnerRecord.id : null)
    const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(defaultPartnerId)
    const [selectedAllowedTrackIds, setSelectedAllowedTrackIds] = useState<number[]>([])
    const [label, setLabel] = useState('')
    const [trackId, setTrackId] = useState('')
    const [copiedKey, setCopiedKey] = useState<string | null>(null)
    const [saveError, setSaveError] = useState('')
    const [saveSuccess, setSaveSuccess] = useState('')
    const [createError, setCreateError] = useState('')
    const [createSuccess, setCreateSuccess] = useState('')
    const [toggleError, setToggleError] = useState('')
    const [isSavingTracks, startSavingTracks] = useTransition()
    const [isCreatingLink, startCreatingLink] = useTransition()
    const [isTogglingLink, startTogglingLink] = useTransition()

    useEffect(() => {
        if (selectedPartnerId != null) return
        if (isAdmin && allPartners[0]?.id) {
            setSelectedPartnerId(allPartners[0].id)
        } else if (!isAdmin && typeof partnerRecord?.id === 'number') {
            setSelectedPartnerId(partnerRecord.id)
        }
    }, [allPartners, isAdmin, partnerRecord?.id, selectedPartnerId])

    const selectedPartner = useMemo(() => {
        if (isAdmin) {
            return allPartners.find((partner) => partner.id === selectedPartnerId) ?? null
        }

        if (!partnerRecord) return null

        return {
            id: partnerRecord.id as number,
            name: partnerRecord.name as string,
            slug: partnerRecord.slug as string,
            tracks: Array.isArray(partnerRecord.tracks)
                ? partnerRecord.tracks
                    .map((track: any) => ({
                        id: typeof track === 'object' ? track?.id : track,
                        name: typeof track === 'object' ? track?.name || '' : '',
                        slug: typeof track === 'object' ? track?.slug || '' : '',
                    }))
                    .filter((track: any) => track.id != null)
                : [],
        }
    }, [allPartners, isAdmin, partnerRecord, selectedPartnerId])
    const selectedPartnerTrackIdsKey = useMemo(
        () =>
            Array.isArray(selectedPartner?.tracks)
                ? selectedPartner.tracks.map((track) => Number(track.id)).sort((left, right) => left - right).join(',')
                : '',
        [selectedPartner],
    )

    useEffect(() => {
        const nextTrackIds = Array.isArray(selectedPartner?.tracks)
            ? selectedPartner.tracks
                .map((track) => Number(track.id))
                .filter((id) => Number.isFinite(id))
            : []
        setSelectedAllowedTrackIds(nextTrackIds)
        setTrackId((current) => {
            if (!current) return nextTrackIds[0] ? String(nextTrackIds[0]) : ''
            return nextTrackIds.includes(Number(current)) ? current : (nextTrackIds[0] ? String(nextTrackIds[0]) : '')
        })
        setSaveError('')
        setSaveSuccess('')
        setCreateError('')
        setCreateSuccess('')
        setToggleError('')
    }, [selectedPartner?.id, selectedPartnerTrackIdsKey])

    const visibleInviteLinks = inviteLinks.filter((link) =>
        selectedPartnerId != null ? Number(link.partnerId) === Number(selectedPartnerId) : false,
    )
    const allowedTrackSet = new Set(selectedAllowedTrackIds)
    const enabledTracks = allTracks.filter((track) => allowedTrackSet.has(Number(track.id)))
    const appOrigin = typeof window !== 'undefined' ? window.location.origin : ''

    const formatDate = (value?: string | null) => {
        if (!value) return 'Never'
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) return 'Never'
        return date.toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    const copyText = async (key: string, value: string) => {
        try {
            await navigator.clipboard.writeText(value)
            setCopiedKey(key)
            window.setTimeout(() => setCopiedKey((current) => current === key ? null : current), 1800)
        } catch {}
    }

    const handleTrackToggle = (nextTrackId: number) => {
        setSelectedAllowedTrackIds((current) =>
            current.includes(nextTrackId)
                ? current.filter((id) => id !== nextTrackId)
                : [...current, nextTrackId].sort((left, right) => left - right),
        )
    }

    const handleSaveTracks = () => {
        if (!selectedPartnerId) return
        setSaveError('')
        setSaveSuccess('')
        startSavingTracks(async () => {
            const result = await updatePartnerReferralTracks({
                partnerId: isAdmin ? selectedPartnerId : undefined,
                trackIds: selectedAllowedTrackIds,
            })

            if ('error' in result) {
                setSaveError(result.error)
                return
            }

            setSaveSuccess('Allowed tracks updated')
            router.refresh()
        })
    }

    const handleCreateLink = () => {
        if (!selectedPartnerId) return
        setCreateError('')
        setCreateSuccess('')
        startCreatingLink(async () => {
            const result = await createPartnerInviteLink({
                label: label.trim(),
                trackId: Number(trackId),
                partnerId: isAdmin ? selectedPartnerId : undefined,
            })

            if ('error' in result) {
                setCreateError(result.error)
                return
            }

            setCreateSuccess('Private referral link created')
            setLabel('')
            router.refresh()
        })
    }

    const handleToggleLink = (linkId: number, isActive: boolean) => {
        if (!selectedPartnerId) return
        setToggleError('')
        startTogglingLink(async () => {
            const result = await setPartnerInviteLinkActive({
                linkId,
                isActive,
                partnerId: isAdmin ? selectedPartnerId : undefined,
            })

            if ('error' in result) {
                setToggleError(result.error)
                return
            }

            router.refresh()
        })
    }

    const publicInviteUrl = selectedPartner?.slug
        ? `/invite/${selectedPartner.slug}`
        : ''

    return (
        <div className="space-y-6">
            <div className="bg-[#203e5f] border border-white/8 rounded-2xl p-6 space-y-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider">Referral Links</h3>
                        <p className="mt-2 text-sm text-white/45 max-w-2xl">
                            Public links lock the partner only. Private links lock both partner and a single track.
                        </p>
                    </div>
                    {isAdmin && (
                        <div className="w-full md:w-[280px]">
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Partner</label>
                            <select
                                value={selectedPartnerId ?? ''}
                                onChange={(event) => setSelectedPartnerId(event.target.value ? Number(event.target.value) : null)}
                                className="w-full bg-[#172433] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/25"
                            >
                                {allPartners.map((partner) => (
                                    <option key={partner.id} value={partner.id}>{partner.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border border-white/8 bg-[#172433] p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">Public partner URL</p>
                            <p className="mt-2 text-sm text-white/80 break-all">{publicInviteUrl || 'Select a partner to view the public invite URL.'}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => publicInviteUrl && copyText(`public-${selectedPartnerId}`, `${appOrigin}${publicInviteUrl}`)}
                            disabled={!publicInviteUrl}
                            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/75 hover:text-white hover:border-white/20 transition-all disabled:opacity-30"
                        >
                            {copiedKey === `public-${selectedPartnerId}` ? 'Copied' : 'Copy public URL'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-[#203e5f] border border-white/8 rounded-2xl p-6">
                <div className="flex flex-col gap-2 mb-4">
                    <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider">Allowed Tracks</h3>
                    <p className="text-sm text-white/40">
                        Private links can only be created for tracks enabled here.
                    </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {allTracks.map((track) => {
                        const active = selectedAllowedTrackIds.includes(track.id)
                        return (
                            <label
                                key={track.id}
                                className="flex items-center gap-3 rounded-xl border border-white/8 bg-[#172433] px-4 py-3 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    checked={active}
                                    onChange={() => handleTrackToggle(track.id)}
                                    className="h-4 w-4 rounded border-white/20 bg-transparent"
                                />
                                <div>
                                    <p className="text-sm font-medium text-white">{track.name}</p>
                                    <p className="text-[11px] uppercase tracking-wider text-white/30">{track.slug}</p>
                                </div>
                            </label>
                        )
                    })}
                </div>
                {saveError && <p className="mt-3 text-sm text-red-400">{saveError}</p>}
                {saveSuccess && <p className="mt-3 text-sm text-green-400">{saveSuccess}</p>}
                <div className="mt-4">
                    <button
                        type="button"
                        onClick={handleSaveTracks}
                        disabled={!selectedPartnerId || isSavingTracks}
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/75 hover:text-white hover:border-white/20 transition-all disabled:opacity-30"
                    >
                        {isSavingTracks ? 'Saving...' : 'Save allowed tracks'}
                    </button>
                </div>
            </div>

            <div className="bg-[#203e5f] border border-white/8 rounded-2xl p-6 space-y-4">
                <div>
                    <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider">Private Link Generator</h3>
                    <p className="mt-2 text-sm text-white/40">
                        Each private link belongs to one partner and one locked track.
                    </p>
                </div>
                <div className="grid gap-3 md:grid-cols-[1.4fr,1fr,auto]">
                    <input
                        type="text"
                        placeholder="Internal label"
                        value={label}
                        onChange={(event) => setLabel(event.target.value)}
                        className="bg-[#172433] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/25"
                    />
                    <select
                        value={trackId}
                        onChange={(event) => setTrackId(event.target.value)}
                        className="bg-[#172433] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/25"
                    >
                        <option value="">Select track</option>
                        {enabledTracks.map((track) => (
                            <option key={track.id} value={track.id}>{track.name}</option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={handleCreateLink}
                        disabled={isCreatingLink || !label.trim() || !trackId}
                        className="rounded-lg bg-[#ffcc00] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#ffcc00]/85 transition-all disabled:opacity-30"
                    >
                        {isCreatingLink ? 'Creating...' : 'Generate link'}
                    </button>
                </div>
                {enabledTracks.length === 0 && (
                    <p className="text-sm text-amber-300/80">
                        Enable at least one allowed track before creating a private link.
                    </p>
                )}
                {createError && <p className="text-sm text-red-400">{createError}</p>}
                {createSuccess && <p className="text-sm text-green-400">{createSuccess}</p>}
            </div>

            <div className="bg-[#203e5f] border border-white/8 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider">
                        Private Links ({visibleInviteLinks.length})
                    </h3>
                </div>
                {toggleError && <p className="mb-3 text-sm text-red-400">{toggleError}</p>}
                {visibleInviteLinks.length === 0 ? (
                    <p className="text-sm text-white/30">No private referral links for this partner yet.</p>
                ) : (
                    <div className="space-y-3">
                        {visibleInviteLinks.map((link) => {
                            const privateUrl = `${appOrigin}/invite/private/${link.token}`
                            return (
                                <div key={link.id} className="rounded-xl border border-white/8 bg-[#172433] p-4">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-sm font-semibold text-white">{link.label}</p>
                                                <span
                                                    className="rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
                                                    style={{
                                                        color: link.isActive ? '#2CB1A1' : 'rgba(255,255,255,0.45)',
                                                        borderColor: link.isActive ? 'rgba(44,177,161,0.35)' : 'rgba(255,255,255,0.12)',
                                                        background: link.isActive ? 'rgba(44,177,161,0.12)' : 'rgba(255,255,255,0.04)',
                                                    }}
                                                >
                                                    {link.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-3 text-xs text-white/35">
                                                <span>{link.track?.name || 'Unknown track'}</span>
                                                <span>Used {link.useCount} time{link.useCount === 1 ? '' : 's'}</span>
                                                <span>Last used {formatDate(link.lastUsedAt)}</span>
                                                <span>Created {formatDate(link.createdAt)}</span>
                                            </div>
                                            <p className="mt-3 text-sm text-white/72 break-all">{privateUrl}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => copyText(`private-${link.id}`, privateUrl)}
                                                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/75 hover:text-white hover:border-white/20 transition-all"
                                            >
                                                {copiedKey === `private-${link.id}` ? 'Copied' : 'Copy private URL'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleToggleLink(link.id, !link.isActive)}
                                                disabled={isTogglingLink}
                                                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/75 hover:text-white hover:border-white/20 transition-all disabled:opacity-30"
                                            >
                                                {link.isActive ? 'Deactivate' : 'Activate'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

/* ─── Main component ─────────────────────────────────────────────────────── */

interface PendingAttempt {
    id: number
    attemptNumber: number
    missCount: number
    missedDays: number[]
    currentDay: number
    founderEmail: string
    founderId: number
    partnerOverrideRequestedAt?: string
}

export default function PartnerDashboard({ user, settings, submissions, partnerRecord, founders, allPartners = [], allTracks = [], inviteLinks = [], pendingAttempts = [], overrideGrantsRemaining = 0 }: {
    user: any
    settings: any
    submissions: Submission[]
    partnerRecord: any
    founders: PartnerFounder[]
    allPartners?: PartnerOption[]
    allTracks?: AvailableTrackOption[]
    inviteLinks?: PartnerInviteLink[]
    pendingAttempts?: PendingAttempt[]
    overrideGrantsRemaining?: number
}) {
    const router = useRouter()
    const [reviewing, setReviewing] = useState<Submission | null>(null)
    const [tab, setTab] = useState<'applications' | 'founders' | 'reviews' | 'decisions' | 'referrals' | 'mentors'>('applications')

    const isAdmin = user.role === 'admin'
    const companyName = settings?.companyName || 'MESGA'

    async function handleBannedWordsSave(words: string) {
        const result = await updatePartnerBannedWords(words)
        if ('error' in result) throw new Error(result.error)
    }

    return (
        <div className="relative min-h-screen bg-[#1a2634] text-white font-sans flex flex-col">
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#ffcc00]/5 blur-[140px] rounded-full" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[35%] h-[35%] bg-[#203e5f]/4 blur-[120px] rounded-full" />
            </div>

            {/* Header */}
            <header className="sticky top-0 z-50 flex items-center justify-center px-4 sm:px-6 py-4 backdrop-blur-md border-b border-white/5 bg-[#1a2634]/80">
                <div className="flex w-full max-w-7xl items-center justify-between">
                    <Link href="/" className="group flex items-center">
                        <MesgaHorizontalLogo
                            companyName={companyName}
                            logoUrl={settings?.logo?.url}
                            size="header"
                            className="transition-opacity group-hover:opacity-85"
                        />
                    </Link>
                    <div className="flex items-center gap-6">
                        <div className="hidden sm:flex flex-col items-end mr-2">
                            <span className="text-sm font-medium text-white/80">{user?.email}</span>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#ffcc00]" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#ffcc00]">
                                    {isAdmin ? 'Admin' : 'Partner'}
                                </span>
                            </div>
                        </div>
                        <form action="/logout" method="POST">
                            <button type="submit" className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-white hover:bg-white/10 hover:border-white/20 transition-all active:scale-95">
                                Log out
                            </button>
                        </form>
                    </div>
                </div>
            </header>

            {/* Main */}
            <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-12">
                {/* Page header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">
                            {isAdmin ? 'Admin Panel' : `Partner — ${partnerRecord?.name ?? ''}`}
                        </p>
                        <h1 className="text-2xl font-black text-white">
                            {isAdmin ? 'Founders & Applications' : 'Partner Dashboard'}
                        </h1>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-8 border-b border-white/8">
                    {(['applications', 'founders', 'reviews' as const, ...(pendingAttempts.length > 0 ? ['decisions' as const] : []), 'referrals' as const, 'mentors' as const] as const).map(t => (
                        <button key={t} onClick={() => setTab(t as any)}
                            className="px-5 py-2.5 text-sm font-bold capitalize transition-all border-b-2 -mb-px"
                            style={{
                                color: tab === t ? 'white' : 'rgba(255,255,255,0.3)',
                                borderColor: tab === t ? '#ffcc00' : 'transparent',
                            }}>
                            {t === 'applications'
                                ? `Applications (${submissions.length})`
                                : t === 'founders'
                                    ? `Founders (${founders.length})`
                                    : t === 'reviews'
                                        ? 'Reviews'
                                        : t === 'decisions'
                                            ? `Decisions (${pendingAttempts.length})`
                                            : t === 'referrals'
                                                ? 'Referrals'
                                                : 'Mentors'}
                        </button>
                    ))}
                </div>

                {tab === 'applications' && (
                    <ApplicationsTab
                        submissions={submissions}
                        isAdmin={isAdmin}
                        partnerRecord={partnerRecord}
                        onReview={setReviewing}
                        onBannedWordsSave={handleBannedWordsSave}
                        allPartners={allPartners}
                        allTracks={allTracks}
                        founders={founders}
                    />
                )}
                {tab === 'founders' && <FoundersTab founders={founders} settings={settings} />}
                {tab === 'reviews' && <PartnerMentorPanel founders={founders} />}
                {tab === 'decisions' && <DecisionsTab pendingAttempts={pendingAttempts} overrideGrantsRemaining={overrideGrantsRemaining} />}
                {tab === 'referrals' && (
                    <ReferralsTab
                        isAdmin={isAdmin}
                        partnerRecord={partnerRecord}
                        allPartners={allPartners}
                        allTracks={allTracks}
                        inviteLinks={inviteLinks}
                    />
                )}
                {tab === 'mentors' && <MentorsTab />}
            </main>

            {/* Footer */}
            <SiteFooter settings={settings} companyName={companyName} variant="compact" />

            {reviewing && (
                <ReviewModal
                    submission={reviewing}
                    intakeSubmission={founders.find(f => f.id === reviewing.user?.id)?.intakeSubmission}
                    onClose={() => setReviewing(null)}
                    onDone={() => { setReviewing(null); router.refresh() }}
                />
            )}
        </div>
    )
}
