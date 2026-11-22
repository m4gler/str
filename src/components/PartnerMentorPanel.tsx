'use client'

import { useMemo, useState } from 'react'
import FounderProgressPanel, { type FounderProgressTimeline } from '@/components/FounderProgressPanel'

interface PartnerMentorFounder {
  id: number
  email: string
  programStatus: string
  progressTimeline?: FounderProgressTimeline | null
}

interface PartnerMentorPanelProps {
  founders: PartnerMentorFounder[]
}

function formatScore(reviews: FounderProgressTimeline['reviews']) {
  if (reviews.length === 0) return '—'
  return (reviews.reduce((sum, review) => sum + review.score, 0) / reviews.length).toFixed(1)
}

export default function PartnerMentorPanel({ founders }: PartnerMentorPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFounderId, setSelectedFounderId] = useState<number | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [optimisticReviewedSubmissionIds, setOptimisticReviewedSubmissionIds] = useState<Set<number>>(new Set())

  const founderRows = useMemo(() => founders.map((founder) => {
    const timeline = founder.progressTimeline
    const submissions = timeline?.submissions ?? []
    const reviews = timeline?.reviews ?? []
    const pendingSubmissions = submissions
      .filter((submission) => !submission.review && !optimisticReviewedSubmissionIds.has(submission.id))
      .sort((a, b) => a.programDay - b.programDay || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    return {
      ...founder,
      timeline,
      pendingSubmissions,
      reviewCount: reviews.length,
      averageScore: formatScore(reviews),
      currentDay: timeline?.currentDay ?? 0,
      completedCount: timeline?.completedDays.length ?? 0,
      missedCount: timeline?.missedDays.length ?? 0,
    }
  }), [founders, optimisticReviewedSubmissionIds])

  const filteredFounders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return founderRows
      .filter((founder) => !query || founder.email.toLowerCase().includes(query))
      .sort((a, b) => {
        if (a.pendingSubmissions.length !== b.pendingSubmissions.length) {
          return b.pendingSubmissions.length - a.pendingSubmissions.length
        }
        return a.email.localeCompare(b.email)
      })
  }, [founderRows, searchQuery])

  const selectedFounder = useMemo(() => {
    if (selectedFounderId == null) return filteredFounders[0] ?? null
    return filteredFounders.find((founder) => founder.id === selectedFounderId) ?? filteredFounders[0] ?? null
  }, [filteredFounders, selectedFounderId])

  const totalPending = founderRows.reduce((sum, founder) => sum + founder.pendingSubmissions.length, 0)
  const pendingGates = founderRows.reduce(
    (sum, founder) => sum + founder.pendingSubmissions.filter((submission) => submission.dayType === 'gate').length,
    0,
  )
  const totalReviews = founderRows.reduce((sum, founder) => sum + founder.reviewCount, 0)
  const activeFounders = founderRows.filter((founder) => founder.programStatus === 'active').length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-[#203e5f] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Needs review</p>
          <p className="mt-2 text-3xl font-black text-white">{totalPending}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300/60">Gate reviews</p>
          <p className="mt-2 text-3xl font-black text-amber-300">{pendingGates}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300/55">Reviewed</p>
          <p className="mt-2 text-3xl font-black text-emerald-300">{totalReviews}</p>
        </div>
        <div className="rounded-2xl border border-[#ffcc00]/15 bg-[#ffcc00]/[0.04] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffcc00]/60">Active founders</p>
          <p className="mt-2 text-3xl font-black text-[#ffcc00]">{activeFounders}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-[#203e5f] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Review workbench</p>
            <p className="mt-1 text-sm text-white/55">{filteredFounders.length} founders in scope</p>
            <input
              type="text"
              placeholder="Search founders..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="mt-4 w-full rounded-xl border border-white/10 bg-[#172433] px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none transition-colors focus:border-[#ffcc00]/50"
            />
          </div>

          <div className="max-h-[680px] space-y-3 overflow-y-auto pr-1">
            {filteredFounders.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#203e5f] p-6 text-sm text-white/30">
                No founders match this search.
              </div>
            ) : (
              filteredFounders.map((founder) => {
                const isSelected = selectedFounder?.id === founder.id
                return (
                  <button
                    key={founder.id}
                    type="button"
                    onClick={() => {
                      setSelectedFounderId(founder.id)
                      setSelectedDay(founder.pendingSubmissions[0]?.programDay ?? founder.currentDay ?? null)
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition-all ${
                      isSelected
                        ? 'border-[#ffcc00]/45 bg-[#ffcc00]/[0.08] shadow-[0_0_30px_-22px_#ffcc00]'
                        : 'border-white/10 bg-[#203e5f] hover:border-white/20 hover:bg-[#274a70]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{founder.email}</p>
                        <p className="mt-1 text-xs text-white/35">
                          Day {founder.currentDay || '—'} · {founder.completedCount} completed
                        </p>
                      </div>
                      {founder.pendingSubmissions.length > 0 && (
                        <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-300">
                          {founder.pendingSubmissions.length}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
                        <p className="text-[9px] uppercase tracking-wider text-white/25">Reviews</p>
                        <p className="text-xs font-semibold text-white/70">{founder.reviewCount}</p>
                      </div>
                      <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
                        <p className="text-[9px] uppercase tracking-wider text-white/25">Missed</p>
                        <p className="text-xs font-semibold text-white/70">{founder.missedCount}</p>
                      </div>
                      <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
                        <p className="text-[9px] uppercase tracking-wider text-white/25">Avg</p>
                        <p className="text-xs font-semibold text-white/70">{founder.averageScore}</p>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <main className="min-w-0 space-y-4">
          {selectedFounder?.timeline ? (
            <>
              <div className="rounded-2xl border border-white/10 bg-[#203e5f] p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#ffcc00]/70">
                      Selected founder
                    </p>
                    <h2 className="mt-1 truncate text-xl font-bold text-white">{selectedFounder.email}</h2>
                    <p className="mt-1 text-sm text-white/40">
                      Day {selectedFounder.currentDay || '—'} · {selectedFounder.completedCount} completed · Avg score {selectedFounder.averageScore}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[300px]">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-white/30">Needs review</p>
                      <p className="text-lg font-bold text-white">{selectedFounder.pendingSubmissions.length}</p>
                    </div>
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-amber-300/55">Gates</p>
                      <p className="text-lg font-bold text-amber-300">
                        {selectedFounder.pendingSubmissions.filter((submission) => submission.dayType === 'gate').length}
                      </p>
                    </div>
                    <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-300/55">Reviews</p>
                      <p className="text-lg font-bold text-emerald-300">{selectedFounder.reviewCount}</p>
                    </div>
                  </div>
                </div>
              </div>

              {selectedFounder.pendingSubmissions.length > 0 && (
                <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300/65">Needs review</p>
                    <p className="text-xs text-white/35">Oldest submissions first</p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {selectedFounder.pendingSubmissions.slice(0, 6).map((submission) => (
                      <button
                        key={submission.id}
                        type="button"
                        onClick={() => setSelectedDay(submission.programDay)}
                        className="rounded-xl border border-white/10 bg-[#172433] p-3 text-left transition-colors hover:border-amber-500/30 hover:bg-amber-500/[0.06]"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-white">Day {submission.programDay}</span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300/65">
                            {submission.dayType}
                          </span>
                        </div>
                        <p className="line-clamp-1 text-xs text-white/45">{submission.formTitle || 'Submitted mission'}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <FounderProgressPanel
                founderEmail={selectedFounder.email}
                allowReview={true}
                selectedDay={selectedDay}
                onSelectedDayChange={setSelectedDay}
                onReviewCreated={(submissionId) => {
                  setOptimisticReviewedSubmissionIds((current) => new Set(current).add(submissionId))
                }}
                timeline={selectedFounder.timeline}
              />
            </>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-[#203e5f] p-12 text-center text-white/30">
              Select a founder with program progress to review submissions.
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
