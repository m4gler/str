'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { User as PayloadUser } from '@/payload-types'
import { saveNpsRating } from '@/app/actions'
import MesgaHorizontalLogo from '@/components/MesgaHorizontalLogo'

interface Review {
    id: number | string
    dayNumber: number
    score: number
    comment: string
    isGateReview: boolean
    gateDecision: string | null
    mentorName: string | null
    createdAt: string
}

interface Submission {
    id: number | string
    programDay: number
    dayType: string
    isBackfill: boolean
    formTitle: string
    createdAt: string
    submissionData: any
    questionLabels?: Record<string, string>
}

interface FeedbackClientProps {
    user: PayloadUser
    reviews: Review[]
    submissions: Submission[]
    companyName: string
    settings: any
    currentDay: number
    completedDays: number[]
    missedDays: number[]
}

type TabKey = 'timeline' | 'reviews' | 'submissions'

const GATE_DAYS = [15, 30, 50, 70, 94]
const CHECKPOINT_DAYS = [0, 15, 30, 45, 60, 75, 90]
const RETRO_EVERY = 7

const DAY_TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
    standard: { bg: 'bg-white/5', text: 'text-white/50', label: 'Daily' },
    retro: { bg: 'bg-[#ffcc00]/10', text: 'text-[#ffcc00]', label: 'Retro' },
    gate: { bg: 'bg-[#ffcc00]/10', text: 'text-[#ffcc00]', label: 'Gate' },
    prework: { bg: 'bg-[#a855f7]/10', text: 'text-[#a855f7]', label: 'Prework' },
}

function getDaySlug(day: number): string {
    if (GATE_DAYS.includes(day)) return `/day/daily-gate-block-${day}`
    if (day % RETRO_EVERY === 0) return `/day/daily-week-block-${Math.floor(day / RETRO_EVERY)}`
    return `/day/daily-day-block-${day}`
}

function normalizeQuestionKey(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function getSubmissionLabel(key: string, questionLabels?: Record<string, string>): string {
    if (questionLabels?.[key]) return questionLabels[key]

    const normalizedKey = normalizeQuestionKey(key)
    const normalizedEntry = Object.entries(questionLabels || {}).find(
        ([questionId]) => normalizeQuestionKey(questionId) === normalizedKey
    )
    if (normalizedEntry?.[1]) return normalizedEntry[1]

    if (key.endsWith('_OTHER')) {
        const baseKey = key.slice(0, -6)
        const baseLabel = getSubmissionLabel(baseKey, questionLabels)
        if (baseLabel !== baseKey.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()) {
            return `${baseLabel} (Other)`
        }
    }

    return key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()
}

function SubmissionDetail({ data, questionLabels }: { data: any; questionLabels?: Record<string, string> }) {
    if (!data || typeof data !== 'object') return null

    const entries = Object.entries(data).filter(
        ([k]) => !k.startsWith('_') && k !== 'form' && k !== 'user'
    )

    if (entries.length === 0) return null

    return (
        <div className="mt-3 space-y-2">
            {entries.map(([key, value]) => {
                const isLink = typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))
                const label = getSubmissionLabel(key, questionLabels)
                return (
                    <div key={key} className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/25 mb-0.5">
                            {label}
                        </p>
                        {isLink ? (
                            <a href={String(value)} target="_blank" rel="noopener noreferrer" className="text-sm text-[#ffcc00] underline break-all">
                                {String(value).split('/').pop() || String(value)}
                            </a>
                        ) : (
                            <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">
                                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '')}
                            </p>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

function TimelineGrid({
    currentDay,
    completedDays,
    missedDays,
    submissions,
    reviews,
}: {
    currentDay: number
    completedDays: number[]
    missedDays: number[]
    submissions: Submission[]
    reviews: Review[]
}) {
    const totalDays = 100
    const completedSet = new Set(completedDays)
    const missedSet = new Set(missedDays)
    const weeks = Math.ceil(totalDays / 7)
    const currentWeek = Math.ceil(Math.max(currentDay, 1) / 7)

    const submissionsByDay = new Map<number, Submission>()
    for (const s of submissions) {
        if (!submissionsByDay.has(s.programDay)) submissionsByDay.set(s.programDay, s)
    }

    const reviewsByDay = new Map<number, Review>()
    for (const r of reviews) {
        if (!reviewsByDay.has(r.dayNumber)) reviewsByDay.set(r.dayNumber, r)
    }

    const scoredReviews = reviews.filter((review) => typeof review.score === 'number')
    const averageScore = scoredReviews.length > 0
        ? (scoredReviews.reduce((sum, review) => sum + review.score, 0) / scoredReviews.length).toFixed(1)
        : '—'
    const latestGateReview = [...reviews]
        .filter((review) => review.isGateReview)
        .sort((a, b) => (b.dayNumber || 0) - (a.dayNumber || 0))[0]

    function getDayStatus(day: number): 'completed' | 'current' | 'missed' | 'future' {
        if (day === currentDay) return 'current'
        if (completedSet.has(day)) return 'completed'
        if (missedSet.has(day)) return 'missed'
        return 'future'
    }

    function getCheckpointStatus(day: number): 'completed' | 'in_progress' | 'future' {
        if (day === 0) return currentDay > 0 ? 'completed' : 'in_progress'
        if (currentDay > day || completedSet.has(day)) return 'completed'

        const checkpointIndex = CHECKPOINT_DAYS.indexOf(day)
        const previousCheckpoint = checkpointIndex > 0 ? CHECKPOINT_DAYS[checkpointIndex - 1] : 0

        if (currentDay > previousCheckpoint && currentDay <= day) return 'in_progress'
        return 'future'
    }

    const rows: number[][] = []
    for (let w = 0; w < weeks; w++) {
        const row: number[] = []
        for (let d = 1; d <= 7; d++) {
            const dayNum = w * 7 + d
            if (dayNum <= totalDays) row.push(dayNum)
        }
        rows.push(row)
    }

    return (
        <div className="space-y-6">
            {/* Progress summary */}
            <div className="rounded-2xl bg-[#203e5f]/50 backdrop-blur-sm border border-white/[0.08] p-5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium mb-1">
                            Program Timeline
                        </p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-white">Day {currentDay}</span>
                            <span className="text-sm text-white/30">/ {totalDays}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#2CB1A1]" />
                            <span className="text-xs text-white/40">{completedDays.length}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#C96A4A]" />
                            <span className="text-xs text-white/40">{missedDays.length}</span>
                        </div>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1 rounded-full bg-white/[0.06] mb-5 overflow-hidden">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-[#2CB1A1] to-[#ffcc00] transition-all duration-500"
                        style={{ width: `${(completedDays.length / totalDays) * 100}%` }}
                    />
                </div>

                <div className="grid gap-3 sm:grid-cols-3 mb-5">
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 font-semibold mb-1">Completed</p>
                        <p className="text-lg font-bold text-white">{completedDays.length}</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 font-semibold mb-1">Avg Mentor Score</p>
                        <p className="text-lg font-bold text-white">{averageScore}{averageScore !== '—' ? <span className="text-sm text-white/35"> / 5</span> : null}</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 font-semibold mb-1">Pitch / Gate Score</p>
                        <p className="text-lg font-bold text-white">
                            {latestGateReview?.score != null ? latestGateReview.score : '—'}
                            {latestGateReview?.score != null ? <span className="text-sm text-white/35"> / 5</span> : null}
                        </p>
                    </div>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-4 mb-5">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 font-semibold">Checkpoints</p>
                        <p className="text-[11px] text-white/25">0 · 15 · 30 · 45 · 60 · 75 · 90</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                        {CHECKPOINT_DAYS.map((checkpoint) => {
                            const status = getCheckpointStatus(checkpoint)
                            const label = checkpoint === 0 ? 'Start' : `Day ${checkpoint}`
                            const statusLabel =
                                status === 'completed'
                                    ? 'Done'
                                    : status === 'in_progress'
                                        ? 'In progress'
                                        : 'Pending'

                            return (
                                <div
                                    key={checkpoint}
                                    className={[
                                        'rounded-lg border px-3 py-2',
                                        status === 'completed'
                                            ? 'border-[#2CB1A1]/30 bg-[#2CB1A1]/10'
                                            : status === 'in_progress'
                                                ? 'border-[#ffcc00]/30 bg-[#ffcc00]/10'
                                                : 'border-white/[0.06] bg-white/[0.02]',
                                    ].join(' ')}
                                >
                                    <p className="text-xs font-semibold text-white">{label}</p>
                                    <p
                                        className={[
                                            'text-[10px] mt-1',
                                            status === 'completed'
                                                ? 'text-[#2CB1A1]'
                                                : status === 'in_progress'
                                                    ? 'text-[#ffcc00]'
                                                    : 'text-white/30',
                                        ].join(' ')}
                                    >
                                        {statusLabel}
                                    </p>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Grid */}
                <div className="max-h-[400px] overflow-y-auto scrollbar-thin pr-1">
                    <div className="space-y-1">
                        {rows.map((row, weekIdx) => {
                            const weekNum = weekIdx + 1
                            const isCurrentWeek = weekNum === currentWeek

                            return (
                                <div
                                    key={weekIdx}
                                    className={`flex items-center gap-1.5 py-0.5 px-1 rounded-lg transition-colors ${
                                        isCurrentWeek ? 'bg-[#ffcc00]/[0.04]' : ''
                                    }`}
                                >
                                    <span
                                        className={`text-[9px] font-medium w-7 shrink-0 text-right ${
                                            isCurrentWeek ? 'text-[#ffcc00]/80' : 'text-white/20'
                                        }`}
                                    >
                                        W{weekNum}
                                    </span>

                                    <div className="flex items-center gap-1 flex-1">
                                        {row.map((day) => {
                                            const status = getDayStatus(day)
                                            const isGate = GATE_DAYS.includes(day)
                                            const isRetro = day % RETRO_EVERY === 0 && !isGate
                                            const isClickable = status === 'completed' || status === 'current'
                                            const slug = getDaySlug(day)
                                            const hasReview = reviewsByDay.has(day)

                                            const cellContent = (
                                                <div
                                                    className={`
                                                        relative flex items-center justify-center transition-all duration-200
                                                        ${isGate ? 'w-7 h-7 rotate-45 border-2' : 'w-7 h-7 rounded-md'}
                                                        ${status === 'completed'
                                                            ? isGate
                                                                ? 'bg-[#a855f7]/20 border-[#a855f7]/60'
                                                                : 'bg-[#2CB1A1]/20 border border-[#2CB1A1]/30'
                                                            : ''
                                                        }
                                                        ${status === 'current'
                                                            ? isGate
                                                                ? 'bg-[#ffcc00]/20 border-[#ffcc00] animate-pulse shadow-[0_0_12px_rgba(228,185,77,0.3)]'
                                                                : 'bg-[#ffcc00]/20 border-2 border-[#ffcc00] animate-pulse shadow-[0_0_12px_rgba(228,185,77,0.3)]'
                                                            : ''
                                                        }
                                                        ${status === 'missed'
                                                            ? isGate
                                                                ? 'bg-[#C96A4A]/20 border-[#C96A4A]/50'
                                                                : 'bg-[#C96A4A]/20 border border-[#C96A4A]/30'
                                                            : ''
                                                        }
                                                        ${status === 'future'
                                                            ? isGate
                                                                ? 'bg-white/[0.03] border-white/[0.08]'
                                                                : 'bg-white/[0.04] border border-white/[0.06]'
                                                            : ''
                                                        }
                                                        ${isClickable ? 'cursor-pointer hover:scale-110 hover:brightness-125' : 'cursor-default'}
                                                    `}
                                                >
                                                    <span
                                                        className={`
                                                            ${isGate ? '-rotate-45' : ''}
                                                            text-[9px] font-medium leading-none select-none
                                                            ${status === 'completed' ? (isGate ? 'text-[#a855f7]' : 'text-[#2CB1A1]') : ''}
                                                            ${status === 'current' ? 'text-[#ffcc00] font-bold' : ''}
                                                            ${status === 'missed' ? 'text-[#C96A4A]' : ''}
                                                            ${status === 'future' ? 'text-white/20' : ''}
                                                        `}
                                                    >
                                                        {isRetro ? 'R' : day}
                                                    </span>

                                                    {/* Review indicator */}
                                                    {hasReview && (
                                                        <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#ffcc00] ${isGate ? '-rotate-45' : ''}`} />
                                                    )}
                                                </div>
                                            )

                                            if (isClickable) {
                                                return (
                                                    <Link key={day} href={slug} className="block">
                                                        {cellContent}
                                                    </Link>
                                                )
                                            }

                                            return <div key={day}>{cellContent}</div>
                                        })}

                                        {row.length < 7 &&
                                            Array.from({ length: 7 - row.length }).map((_, i) => (
                                                <div key={`empty-${i}`} className="w-7 h-7" />
                                            ))
                                        }
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 pt-3 border-t border-white/[0.06]">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-[#2CB1A1]/30 border border-[#2CB1A1]/40" />
                        <span className="text-[10px] text-white/30">Completed</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-[#ffcc00]/30 border-2 border-[#ffcc00]" />
                        <span className="text-[10px] text-white/30">Current</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-[#C96A4A]/30 border border-[#C96A4A]/40" />
                        <span className="text-[10px] text-white/30">Missed</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rotate-45 bg-[#a855f7]/20 border border-[#a855f7]/50" />
                        <span className="text-[10px] text-white/30">Gate</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-[7px] text-white/30">R</span>
                        <span className="text-[10px] text-white/30">Retro</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ffcc00]" />
                        <span className="text-[10px] text-white/30">Has review</span>
                    </div>
                </div>
            </div>

            <p className="text-[11px] text-white/25 text-center">Click any completed day to view your submission (read-only).</p>
        </div>
    )
}

function NpsRating({ user }: { user: PayloadUser }) {
    const [npsMentors, setNpsMentors] = useState<number | null>((user as any).npsMentors ?? null)
    const [npsTasks, setNpsTasks] = useState<number | null>((user as any).npsTasks ?? null)
    const [npsBlocks, setNpsBlocks] = useState<number | null>((user as any).npsBlocks ?? null)
    const [saved, setSaved] = useState(false)
    const [isPending, startTransition] = useTransition()

    const categories = [
        { label: 'Mentors', value: npsMentors, setter: setNpsMentors, key: 'npsMentors' as const },
        { label: 'Daily Tasks', value: npsTasks, setter: setNpsTasks, key: 'npsTasks' as const },
        { label: 'Program Blocks', value: npsBlocks, setter: setNpsBlocks, key: 'npsBlocks' as const },
    ]

    function handleSave() {
        startTransition(async () => {
            await saveNpsRating({
                npsMentors: npsMentors ?? undefined,
                npsTasks: npsTasks ?? undefined,
                npsBlocks: npsBlocks ?? undefined,
            })
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        })
    }

    return (
        <div className="mt-6 rounded-2xl bg-[#203e5f]/50 backdrop-blur-sm border border-white/[0.08] p-5">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium mb-1">Your Rating</p>
                    <p className="text-sm text-white/30">Rate your experience so far (0–10)</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isPending}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#ffcc00]/15 text-[#ffcc00] border border-[#ffcc00]/20 hover:bg-[#ffcc00]/25 transition-all disabled:opacity-50 cursor-pointer"
                >
                    {isPending ? 'Saving...' : saved ? 'Saved!' : 'Save Ratings'}
                </button>
            </div>
            <div className="space-y-4">
                {categories.map(({ label, value, setter }) => (
                    <div key={label}>
                        <p className="text-xs font-semibold text-white/50 mb-2">{label}</p>
                        <div className="flex gap-1.5">
                            {Array.from({ length: 11 }, (_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setter(i)}
                                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        value === i
                                            ? i <= 6
                                                ? 'bg-[#C96A4A] text-white shadow-lg shadow-[#C96A4A]/30'
                                                : i <= 8
                                                    ? 'bg-[#ffcc00] text-black shadow-lg shadow-[#ffcc00]/30'
                                                    : 'bg-[#2CB1A1] text-white shadow-lg shadow-[#2CB1A1]/30'
                                            : 'bg-white/5 text-white/40 border border-white/[0.06] hover:bg-white/10 hover:text-white/60'
                                    }`}
                                >
                                    {i}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default function FeedbackClient({
    user,
    reviews,
    submissions,
    companyName,
    settings,
    currentDay,
    completedDays,
    missedDays,
}: FeedbackClientProps) {
    const [activeTab, setActiveTab] = useState<TabKey>('timeline')
    const [expandedSubmissions, setExpandedSubmissions] = useState<Set<string | number>>(new Set())

    const toggleSubmission = (id: string | number) => {
        setExpandedSubmissions(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const tabs: { key: TabKey; label: string; count?: number }[] = [
        { key: 'timeline', label: 'Timeline' },
        { key: 'reviews', label: 'Mentor Reviews', count: reviews.length },
        { key: 'submissions', label: 'My Submissions', count: submissions.length },
    ]

    return (
        <div className="relative min-h-screen bg-[#1a2634] text-white font-sans flex flex-col">
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#E0C188]/6 blur-[130px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#ffcc00]/6 blur-[130px] rounded-full" />
            </div>

            <header className="sticky top-0 z-50 flex items-center justify-center px-4 sm:px-6 py-4 backdrop-blur-md border-b border-white/5 bg-[#1a2634]/80">
                <div className="flex w-full max-w-5xl items-center justify-between">
                    <Link href="/" className="group flex items-center">
                        <MesgaHorizontalLogo
                            companyName={companyName}
                            logoUrl={settings?.logo?.url}
                            size="header"
                            className="transition-opacity group-hover:opacity-85"
                        />
                    </Link>
                    <Link
                        href="/"
                        className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-white hover:bg-white/10 hover:border-white/20 transition-all"
                    >
                        Dashboard
                    </Link>
                </div>
            </header>

            <main className="relative z-10 max-w-5xl mx-auto w-full px-6 pt-12 pb-20 flex-1">
                {/* Page Title */}
                <div className="mb-10">
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">Mentors & Feedback</h1>
                    <p className="text-white/40 text-sm">Your submission history and mentor reviews in one place.</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-8 p-1 rounded-2xl bg-white/[0.03] border border-white/[0.06] w-fit">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                                activeTab === tab.key
                                    ? 'bg-white/10 text-white shadow-sm'
                                    : 'text-white/40 hover:text-white/60'
                            }`}
                        >
                            {tab.label}
                            {tab.count !== undefined && (
                                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                                    activeTab === tab.key ? 'bg-white/15 text-white/70' : 'bg-white/5 text-white/25'
                                }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Timeline Tab */}
                {activeTab === 'timeline' && currentDay > 0 && (
                    <TimelineGrid
                        currentDay={currentDay}
                        completedDays={completedDays}
                        missedDays={missedDays}
                        submissions={submissions}
                        reviews={reviews}
                    />
                )}

                {activeTab === 'timeline' && currentDay > 0 && (
                    <NpsRating user={user} />
                )}

                {activeTab === 'timeline' && currentDay === 0 && (
                    <div className="rounded-2xl border border-white/[0.06] bg-[#203e5f]/50 p-12 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                            </svg>
                        </div>
                        <p className="text-white/30 text-sm">No active program yet. The timeline will appear once your program starts.</p>
                    </div>
                )}

                {/* Reviews Tab */}
                {activeTab === 'reviews' && (
                    <div className="space-y-4">
                        {reviews.length === 0 ? (
                            <div className="rounded-2xl border border-white/[0.06] bg-[#203e5f]/50 p-12 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                                    </svg>
                                </div>
                                <p className="text-white/30 text-sm">No mentor reviews yet. Reviews will appear here once a mentor evaluates your submissions.</p>
                            </div>
                        ) : (
                            reviews.map(review => (
                                <div
                                    key={review.id}
                                    className={`rounded-2xl border p-5 transition-all ${
                                        review.isGateReview
                                            ? 'bg-[#ffcc00]/[0.03] border-[#ffcc00]/15'
                                            : 'bg-[#203e5f]/50 border-white/[0.06]'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-4 mb-3">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <span className="text-sm font-bold text-white">Day {review.dayNumber}</span>
                                            {review.isGateReview && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ffcc00]/15 text-[#ffcc00] border border-[#ffcc00]/25 font-bold uppercase tracking-wider">
                                                    Gate Review
                                                </span>
                                            )}
                                            {review.gateDecision && (
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ${
                                                    review.gateDecision === 'pass'
                                                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                                                        : review.gateDecision === 'fail'
                                                            ? 'bg-red-500/15 text-red-400 border-red-500/25'
                                                            : 'bg-amber-500/15 text-amber-400 border-amber-500/25'
                                                }`}>
                                                    {review.gateDecision}
                                                </span>
                                            )}
                                            {review.mentorName && (
                                                <span className="text-[10px] text-white/25 font-medium">
                                                    by {review.mentorName}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-0.5 shrink-0">
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <span
                                                    key={star}
                                                    className={`text-sm ${star <= review.score ? 'text-[#ffcc00]' : 'text-white/10'}`}
                                                >
                                                    ★
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    {review.comment && (
                                        <p className="text-sm text-white/60 leading-relaxed">{review.comment}</p>
                                    )}
                                    <p className="text-[10px] text-white/20 mt-3">
                                        {new Date(review.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Submissions Tab */}
                {activeTab === 'submissions' && (
                    <div className="space-y-3">
                        {submissions.length === 0 ? (
                            <div className="rounded-2xl border border-white/[0.06] bg-[#203e5f]/50 p-12 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                    </svg>
                                </div>
                                <p className="text-white/30 text-sm">No daily submissions yet. Your completed daily forms will appear here.</p>
                            </div>
                        ) : (
                            submissions.map(sub => {
                                const expanded = expandedSubmissions.has(sub.id)
                                const dtCfg = DAY_TYPE_COLORS[sub.dayType] || DAY_TYPE_COLORS.standard
                                const matchingReview = reviews.find(r => r.dayNumber === sub.programDay)

                                return (
                                    <div
                                        key={sub.id}
                                        className="rounded-2xl border border-white/[0.06] bg-[#203e5f]/50 overflow-hidden transition-all"
                                    >
                                        <button
                                            onClick={() => toggleSubmission(sub.id)}
                                            className="w-full flex items-center gap-4 px-5 py-4 text-left cursor-pointer hover:bg-white/[0.02] transition-colors"
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                                                <span className="text-sm font-black text-white/50">{sub.programDay}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm font-semibold text-white truncate">{sub.formTitle}</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${dtCfg.bg} ${dtCfg.text} font-bold uppercase tracking-wider border border-current/15`}>
                                                        {dtCfg.label}
                                                    </span>
                                                    {sub.isBackfill && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/15 font-bold uppercase tracking-wider">
                                                            Backfill
                                                        </span>
                                                    )}
                                                    {matchingReview && (
                                                        <span className="text-[10px] text-[#ffcc00]/60">
                                                            ★ {matchingReview.score}/5
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-white/25 mt-0.5">
                                                    {new Date(sub.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    {' · '}
                                                    {new Date(sub.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                            <svg
                                                className={`w-4 h-4 text-white/20 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth={2}
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                            </svg>
                                        </button>

                                        {expanded && sub.submissionData && (
                                            <div className="px-5 pb-4 border-t border-white/[0.04]">
                                                <SubmissionDetail data={sub.submissionData} questionLabels={sub.questionLabels} />
                                            </div>
                                        )}
                                    </div>
                                )
                            })
                        )}
                    </div>
                )}
            </main>
        </div>
    )
}
