'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createMentorReview, updateMentorReview } from '@/app/actions'

export interface FounderProgressReview {
  id: number | string
  dayNumber: number
  score: number
  comment: string
  internalNote?: string | null
  isGateReview: boolean
  gateDecision?: string | null
  mentorName?: string | null
  createdAt: string
}

export interface FounderProgressSubmission {
  id: number
  programDay: number
  dayType: string
  isBackfill: boolean
  formTitle: string
  createdAt: string
  submissionData: Record<string, any> | null
  questionLabels?: Record<string, string>
  review?: FounderProgressReview | null
}

export interface FounderProgressTimeline {
  currentDay: number
  completedDays: number[]
  missedDays: number[]
  submissions: FounderProgressSubmission[]
  reviews: FounderProgressReview[]
}

const GATE_DAYS = [15, 30, 50, 70, 94]
const RETRO_EVERY = 7

function normalizeQuestionKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isSubmissionUrlValue(value: unknown): boolean {
  return typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))
}

function getLegacyDailyQuestionLabel(key: string, value?: unknown): string | null {
  const match = key.match(/^DP\d+-(\d{3})$/i)
  if (!match) return null
  const index = match[1]

  if (isSubmissionUrlValue(value)) return 'Project workspace URL'
  if (index === '001') return 'Summary Note'
  if (index === '002') return 'Summary Note'

  const legacyDailyLabels: Record<string, string> = {
    '003': 'Mission completed?',
    '004': 'Workspace updated?',
    '005': 'Core output',
    '006': 'Mentor ask',
    '007': 'Decision',
  }

  return legacyDailyLabels[index] ?? `Response ${Number(index)}`
}

function getLegacyGateQuestionLabel(key: string, value?: unknown): string | null {
  const match = key.match(/^G\d+-(\d{3})$/i)
  if (!match) return null
  const index = match[1]

  if (isSubmissionUrlValue(value)) return 'Evidence pack URL'

  const legacyGateLabels: Record<string, string> = {
    '001': 'Gate briefing',
    '002': 'Evidence pack URL',
    '003': 'Gate self-assessment',
    '004': 'Key metrics / evidence',
    '005': 'Decision',
    '006': 'Mentor / IC ask (optional)',
  }

  return legacyGateLabels[index] ?? `Gate response ${Number(index)}`
}

function getSubmissionLabel(key: string, questionLabels?: Record<string, string>, value?: unknown): string {
  const legacyDailyLabel = getLegacyDailyQuestionLabel(key, value)
  if (legacyDailyLabel) return legacyDailyLabel
  const legacyGateLabel = getLegacyGateQuestionLabel(key, value)
  if (legacyGateLabel) return legacyGateLabel

  if (questionLabels?.[key]) return questionLabels[key]

  const normalizedKey = normalizeQuestionKey(key)
  const normalizedEntry = Object.entries(questionLabels || {}).find(
    ([questionId]) => normalizeQuestionKey(questionId) === normalizedKey,
  )
  if (normalizedEntry?.[1]) return normalizedEntry[1]

  if (key.endsWith('_OTHER')) {
    const baseKey = key.slice(0, -6)
    const baseLabel = getSubmissionLabel(baseKey, questionLabels, value)
    const fallback = baseKey.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()
    if (baseLabel !== fallback) return `${baseLabel} (Other)`
  }

  return key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatSubmissionUrlLabel(value: string): string {
  try {
    const parsed = new URL(value)
    const path = parsed.pathname.replace(/\/$/, '')
    return `${parsed.hostname}${path}`
  } catch {
    return value
  }
}

function StarRating({
  value,
  onChange,
  readonly,
}: {
  value: number
  onChange?: (value: number) => void
  readonly?: boolean
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          className={`text-lg transition-colors ${
            star <= value ? 'text-yellow-400' : 'text-white/15'
          } ${readonly ? 'cursor-default' : 'cursor-pointer hover:text-yellow-300'}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function SubmissionDetail({
  data,
  questionLabels,
}: {
  data: Record<string, any> | null
  questionLabels?: Record<string, string>
}) {
  if (!data || typeof data !== 'object') {
    return <p className="text-sm text-white/30">No responses for this day.</p>
  }

  const entries = Object.entries(data).filter(
    ([key, value]) => !key.startsWith('_') && key !== 'form' && key !== 'user' && value !== '' && value != null,
  )

  if (entries.length === 0) {
    return <p className="text-sm text-white/30">No responses for this day.</p>
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => {
        const label = getSubmissionLabel(key, questionLabels, value)
        const isLink = isSubmissionUrlValue(value)

        return (
          <div key={key} className="rounded-lg bg-white/[0.03] border border-white/[0.05] px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/25 mb-0.5">
              {label}
            </p>
            {isLink ? (
              <a href={String(value)} target="_blank" rel="noopener noreferrer" className="text-sm text-[#ffcc00] underline break-all">
                {formatSubmissionUrlLabel(String(value))}
              </a>
            ) : (
              <p className="text-sm text-white/65 leading-relaxed whitespace-pre-wrap break-words">
                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ReviewComposer({
  submission,
  existingReview,
  onDone,
}: {
  submission: FounderProgressSubmission
  existingReview?: FounderProgressReview | null
  onDone: (review?: FounderProgressReview) => void
}) {
  const router = useRouter()
  const [score, setScore] = useState(existingReview?.score ?? 0)
  const [comment, setComment] = useState(existingReview?.comment ?? '')
  const [internalNote, setInternalNote] = useState(existingReview?.internalNote ?? '')
  const [gateDecision, setGateDecision] = useState<'pass' | 'fail' | 'revise' | ''>(
    existingReview?.gateDecision === 'pass' || existingReview?.gateDecision === 'fail' || existingReview?.gateDecision === 'revise'
      ? existingReview.gateDecision
      : '',
  )
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const isGate = submission.dayType === 'gate'
  const isEditing = Boolean(existingReview)

  function handleSubmit() {
    if (score < 1 || score > 5) {
      setError('Please set a score from 1 to 5.')
      return
    }
    if (!comment.trim()) {
      setError('Please add feedback for the founder.')
      return
    }
    if (isGate && !gateDecision) {
      setError('Gate reviews require a pass/fail/revise decision.')
      return
    }

    setError('')
    startTransition(async () => {
      const reviewId = Number(existingReview?.id)
      const result = isEditing
        ? Number.isFinite(reviewId)
          ? await updateMentorReview(reviewId, {
              score,
              comment,
              internalNote: internalNote || '',
              gateDecision: isGate && gateDecision ? gateDecision : null,
            })
          : { error: 'This review is still syncing. Refresh before editing it.' }
        : await createMentorReview({
            submissionId: submission.id,
            dayNumber: submission.programDay,
            score,
            comment,
            internalNote: internalNote || undefined,
            isGateReview: isGate,
            gateDecision: isGate && gateDecision ? gateDecision : undefined,
          })

      if ('error' in result) {
        setError(result.error)
        return
      }

      const createdReviewId =
        !isEditing && 'reviewId' in result && typeof result.reviewId === 'number'
          ? result.reviewId
          : undefined
      const savedReviewId = existingReview?.id ?? createdReviewId ?? `optimistic-${submission.id}`
      const optimisticReview: FounderProgressReview = {
        id: savedReviewId,
        dayNumber: submission.programDay,
        score,
        comment,
        internalNote: internalNote || null,
        isGateReview: isGate,
        gateDecision: isGate && gateDecision ? gateDecision : null,
        mentorName: existingReview?.mentorName ?? 'You',
        createdAt: existingReview?.createdAt ?? new Date().toISOString(),
      }

      onDone(optimisticReview)
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#111] p-4 space-y-4">
      <div>
        <p className="text-xs text-white/40 mb-2">Score</p>
        <StarRating value={score} onChange={setScore} />
      </div>

      <div>
        <label className="text-xs text-white/40 block mb-1">Feedback</label>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={4}
          className="w-full bg-[#172433] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 resize-none"
          placeholder="What should the founder keep, change, or improve?"
        />
      </div>

      <div>
        <label className="text-xs text-white/40 block mb-1">Internal note</label>
        <textarea
          value={internalNote}
          onChange={(event) => setInternalNote(event.target.value)}
          rows={2}
          className="w-full bg-[#172433] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 resize-none"
          placeholder="Optional internal context."
        />
      </div>

      {isGate && (
        <div>
          <p className="text-xs text-white/40 mb-2">Gate decision</p>
          <div className="flex gap-2 flex-wrap">
            {(['pass', 'fail', 'revise'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setGateDecision(option)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold uppercase tracking-wider ${
                  gateDecision === option
                    ? option === 'pass'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : option === 'fail'
                        ? 'bg-red-500/15 text-red-300 border-red-500/30'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-white/5 text-white/45 border-white/10'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="px-4 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-white/90 disabled:opacity-50"
        >
          {isPending ? 'Saving...' : isEditing ? 'Save review' : 'Submit review'}
        </button>
        <button
          type="button"
          onClick={() => onDone()}
          className="px-4 py-2 text-sm text-white/45 hover:text-white/70"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function FounderProgressPanel({
  founderEmail,
  timeline,
  allowReview = false,
  selectedDay,
  onSelectedDayChange,
  onReviewCreated,
}: {
  founderEmail: string
  timeline?: FounderProgressTimeline | null
  allowReview?: boolean
  selectedDay?: number | null
  onSelectedDayChange?: (day: number) => void
  onReviewCreated?: (submissionId: number) => void
}) {
  const [internalSelectedDay, setInternalSelectedDay] = useState<number | null>(null)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [optimisticReviews, setOptimisticReviews] = useState<FounderProgressReview[]>([])

  const currentDay = timeline?.currentDay ?? 0
  const completedDays = useMemo(() => timeline?.completedDays ?? [], [timeline?.completedDays])
  const missedDays = useMemo(() => timeline?.missedDays ?? [], [timeline?.missedDays])
  const submissions = useMemo(() => timeline?.submissions ?? [], [timeline?.submissions])
  const serverReviews = useMemo(() => timeline?.reviews ?? [], [timeline?.reviews])
  const reviews = useMemo(() => {
    const map = new Map<string, FounderProgressReview>()
    for (const review of serverReviews) {
      map.set(String(review.id), review)
    }
    for (const review of optimisticReviews) {
      const matchingServerReview = serverReviews.find((item) => item.dayNumber === review.dayNumber)
      if (matchingServerReview && String(matchingServerReview.id) !== String(review.id)) continue
      map.set(String(review.id), review)
    }
    return [...map.values()]
  }, [optimisticReviews, serverReviews])

  const completedSet = useMemo(() => new Set(completedDays), [completedDays])
  const missedSet = useMemo(() => new Set(missedDays), [missedDays])

  const submissionsByDay = useMemo(() => {
    const map = new Map<number, FounderProgressSubmission>()
    for (const submission of submissions) {
      if (!map.has(submission.programDay)) map.set(submission.programDay, submission)
    }
    return map
  }, [submissions])

  const reviewsByDay = useMemo(() => {
    const map = new Map<number, FounderProgressReview>()
    for (const review of reviews) {
      if (!map.has(review.dayNumber)) map.set(review.dayNumber, review)
    }
    return map
  }, [reviews])

  const resolvedSelectedDay = selectedDay ?? internalSelectedDay
    ?? submissions[submissions.length - 1]?.programDay
    ?? (currentDay > 0 ? currentDay : null)

  function selectDay(day: number) {
    onSelectedDayChange?.(day)
    if (selectedDay === undefined) setInternalSelectedDay(day)
  }

  function handleReviewSaved(submission: FounderProgressSubmission, review?: FounderProgressReview) {
    if (review) {
      setOptimisticReviews((current) => [
        ...current.filter((item) => item.dayNumber !== review.dayNumber && String(item.id) !== String(review.id)),
        review,
      ])
      onReviewCreated?.(submission.id)
    }
    setShowReviewForm(false)
  }

  const selectedSubmission = resolvedSelectedDay != null ? submissionsByDay.get(resolvedSelectedDay) ?? null : null
  const selectedReview = resolvedSelectedDay != null
    ? reviewsByDay.get(resolvedSelectedDay) ?? selectedSubmission?.review ?? null
    : null

  const totalDays = 100
  const rows: number[][] = []
  for (let week = 0; week < Math.ceil(totalDays / 7); week++) {
    const row: number[] = []
    for (let index = 1; index <= 7; index++) {
      const day = week * 7 + index
      if (day <= totalDays) row.push(day)
    }
    rows.push(row)
  }

  const scoredReviews = reviews.filter((review) => typeof review.score === 'number')
  const averageScore = scoredReviews.length > 0
    ? (scoredReviews.reduce((sum, review) => sum + review.score, 0) / scoredReviews.length).toFixed(1)
    : '—'

  if (!timeline) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
        <p className="text-sm text-white/30">No program timeline available for this founder yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30 mb-1">100-Day Progress</p>
            <p className="text-sm text-white/55">{founderEmail}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-white">Day {currentDay || '—'}</p>
            <p className="text-xs text-white/30">{completedDays.length} completed</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4 mb-5">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 font-semibold mb-1">Completed</p>
            <p className="text-lg font-bold text-white">{completedDays.length}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 font-semibold mb-1">Missed</p>
            <p className="text-lg font-bold text-white">{missedDays.length}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 font-semibold mb-1">Reviews</p>
            <p className="text-lg font-bold text-white">{reviews.length}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 font-semibold mb-1">Avg Score</p>
            <p className="text-lg font-bold text-white">{averageScore}{averageScore !== '—' ? <span className="text-sm text-white/35"> / 5</span> : null}</p>
          </div>
        </div>

        <div className="w-full h-1 rounded-full bg-white/[0.06] mb-5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#2CB1A1] to-[#ffcc00]"
            style={{ width: `${(completedDays.length / totalDays) * 100}%` }}
          />
        </div>

        <div className="max-h-[420px] overflow-y-auto pr-1">
          <div className="space-y-1">
            {rows.map((row, weekIndex) => (
              <div key={weekIndex} className="flex items-center gap-1.5 py-0.5 px-1 rounded-lg">
                <span className="text-[9px] font-medium w-7 shrink-0 text-right text-white/20">
                  W{weekIndex + 1}
                </span>
                <div className="flex items-center gap-1 flex-1">
                  {row.map((day) => {
                    const isGate = GATE_DAYS.includes(day)
                    const isRetro = day % RETRO_EVERY === 0 && !isGate
                    const hasSubmission = submissionsByDay.has(day)
                    const hasReview = reviewsByDay.has(day)
                    const isSelected = resolvedSelectedDay === day
                    const reviewedDayClass = hasReview
                      ? isGate
                        ? 'bg-emerald-500/25 border-emerald-400/80 shadow-[0_0_16px_-8px_#34d399]'
                        : 'bg-emerald-500/25 border-2 border-emerald-400/70 shadow-[0_0_16px_-8px_#34d399]'
                      : ''
                    const reviewedTextClass = hasReview ? 'text-emerald-100' : ''

                    const status =
                      day === currentDay
                        ? 'current'
                        : completedSet.has(day)
                          ? 'completed'
                          : missedSet.has(day)
                            ? 'missed'
                            : 'future'

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          selectDay(day)
                          setShowReviewForm(false)
                        }}
                        className={`
                          relative flex items-center justify-center transition-all duration-200
                          ${isGate ? 'w-7 h-7 rotate-45 border-2' : 'w-7 h-7 rounded-md'}
                          ${status === 'completed' ? (isGate ? 'bg-[#a855f7]/20 border-[#a855f7]/60' : 'bg-[#2CB1A1]/20 border border-[#2CB1A1]/30') : ''}
                          ${status === 'current' ? (isGate ? 'bg-[#ffcc00]/20 border-[#ffcc00]' : 'bg-[#ffcc00]/20 border-2 border-[#ffcc00]') : ''}
                          ${status === 'missed' ? (isGate ? 'bg-[#C96A4A]/20 border-[#C96A4A]/50' : 'bg-[#C96A4A]/20 border border-[#C96A4A]/30') : ''}
                          ${status === 'future' ? (isGate ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-white/[0.04] border border-white/[0.06]') : ''}
                          ${reviewedDayClass}
                          ${isSelected ? 'ring-2 ring-[#ffcc00]/60 ring-offset-1 ring-offset-[#203e5f]' : ''}
                          ${(hasSubmission || hasReview || day === currentDay) ? 'cursor-pointer hover:scale-110 hover:brightness-125' : 'cursor-default'}
                        `}
                      >
                        <span className={`${isGate ? '-rotate-45' : ''} text-[9px] font-medium leading-none ${reviewedTextClass || (status === 'future' ? 'text-white/20' : status === 'missed' ? 'text-[#C96A4A]' : status === 'current' ? 'text-[#ffcc00]' : isGate ? 'text-[#a855f7]' : 'text-[#2CB1A1]')}`}>
                          {isRetro ? 'R' : day}
                        </span>
                        {hasReview && (
                          <span className={`absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-emerald-400 text-[8px] font-bold text-[#06251b] ${isGate ? '-rotate-45' : ''}`}>
                            ✓
                          </span>
                        )}
                        {hasSubmission && !hasReview && (
                          <span className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#ffcc00] ${isGate ? '-rotate-45' : ''}`} />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

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
            <span className="w-1.5 h-1.5 rounded-full bg-[#ffcc00]" />
            <span className="text-[10px] text-white/30">Has submission</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex h-3 w-3 items-center justify-center rounded-full bg-emerald-400 text-[8px] font-bold text-[#06251b]">✓</span>
            <span className="text-[10px] text-white/30">Reviewed</span>
          </div>
        </div>
      </div>

      {resolvedSelectedDay != null && (
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30 mb-1">Day Detail</p>
              <h4 className="text-base font-semibold text-white">
                Day {resolvedSelectedDay}
                {selectedSubmission ? ` · ${selectedSubmission.formTitle}` : ''}
              </h4>
              {selectedSubmission && (
                <p className="text-xs text-white/35 mt-1">
                  Submitted {formatDate(selectedSubmission.createdAt)}
                  {selectedSubmission.isBackfill ? ' · Backfill' : ''}
                </p>
              )}
            </div>
            {selectedSubmission && allowReview && !showReviewForm && (
              <button
                type="button"
                onClick={() => setShowReviewForm(true)}
                className="px-4 py-2 rounded-lg bg-white text-black text-sm font-semibold hover:bg-white/90"
              >
                {selectedReview ? 'Edit review' : 'Review day'}
              </button>
            )}
          </div>

          {selectedSubmission ? (
            <SubmissionDetail data={selectedSubmission.submissionData} questionLabels={selectedSubmission.questionLabels} />
          ) : (
            <p className="text-sm text-white/30">No submission recorded for this day.</p>
          )}

          {selectedReview && !showReviewForm && (
            <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-4">
              <div className="flex items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-3">
                  <StarRating value={selectedReview.score} readonly />
                  <span className="text-sm text-white/55">{selectedReview.score}/5</span>
                </div>
                <p className="text-xs text-white/35">{formatDate(selectedReview.createdAt)}</p>
              </div>
              {selectedReview.gateDecision && (
                <p className="text-xs text-white/45 mb-2 uppercase tracking-wider">
                  Gate decision: {selectedReview.gateDecision}
                </p>
              )}
              <p className="text-sm text-white/70 whitespace-pre-wrap">{selectedReview.comment}</p>
              {selectedReview.internalNote && (
                <div className="mt-3 rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-white/25 mb-1">Internal note</p>
                  <p className="text-xs text-white/55 whitespace-pre-wrap">{selectedReview.internalNote}</p>
                </div>
              )}
            </div>
          )}

          {selectedSubmission && allowReview && showReviewForm && (
            <ReviewComposer
              submission={selectedSubmission}
              existingReview={selectedReview}
              onDone={(review) => handleReviewSaved(selectedSubmission, review)}
            />
          )}
        </div>
      )}
    </div>
  )
}
