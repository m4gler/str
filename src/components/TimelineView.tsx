'use client'

import Link from 'next/link'

interface TimelineViewProps {
  currentDay: number
  completedDays: number[]
  missedDays: number[]
  totalDays?: number
  gateDays?: number[]
  retroEveryN?: number
  unlockAllDays?: boolean
}

const GATE_DAYS_DEFAULT = [15, 30, 50, 70, 94]
const RETRO_EVERY_DEFAULT = 7

function getDaySlug(day: number, gateDays: number[], retroEveryN: number): string {
  if (gateDays.includes(day)) return `/day/daily-gate-block-${day}`
  if (day % retroEveryN === 0) return `/day/daily-week-block-${Math.floor(day / retroEveryN)}`
  return `/day/daily-day-block-${day}`
}

export default function TimelineView({
  currentDay,
  completedDays,
  missedDays,
  totalDays = 100,
  gateDays = GATE_DAYS_DEFAULT,
  retroEveryN = RETRO_EVERY_DEFAULT,
  unlockAllDays = false,
}: TimelineViewProps) {
  const completedSet = new Set(completedDays)
  const missedSet = new Set(missedDays)
  const weeks = Math.ceil(totalDays / 7)

  function getDayStatus(day: number): 'completed' | 'current' | 'missed' | 'future' {
    if (day === currentDay) return 'current'
    if (completedSet.has(day)) return 'completed'
    if (missedSet.has(day)) return 'missed'
    return 'future'
  }

  function isClickable(day: number): boolean {
    if (unlockAllDays) return true
    const status = getDayStatus(day)
    return status === 'completed' || status === 'current'
  }

  function isGate(day: number): boolean {
    return gateDays.includes(day)
  }

  function isRetro(day: number): boolean {
    return day % retroEveryN === 0 && !isGate(day)
  }

  // Build rows by week (7 days per row)
  const rows: number[][] = []
  for (let w = 0; w < weeks; w++) {
    const row: number[] = []
    for (let d = 1; d <= 7; d++) {
      const dayNum = w * 7 + d
      if (dayNum <= totalDays) row.push(dayNum)
    }
    rows.push(row)
  }

  // Current week index for auto-scroll hint
  const currentWeek = Math.ceil(currentDay / 7)

  return (
    <div className="mb-10 rounded-2xl bg-[#203e5f]/50 backdrop-blur-sm border border-white/[0.08] p-5">
      {/* Header */}
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

        {/* Progress summary */}
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

      {/* Timeline grid */}
      <div className="max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
        <div className="space-y-1">
          {rows.map((row, weekIdx) => {
            const weekNum = weekIdx + 1
            const isCurrentWeek = weekNum === currentWeek

            return (
              <div
                key={weekIdx}
                className={`flex items-center gap-3 sm:gap-4 md:gap-5 py-0.5 px-1 rounded-lg transition-colors ${
                  isCurrentWeek ? 'bg-[#ffcc00]/[0.04]' : ''
                }`}
              >
                {/* Week label */}
                <span
                  className={`text-[9px] font-medium w-7 shrink-0 text-right ${
                    isCurrentWeek
                      ? 'text-[#ffcc00]/80'
                      : 'text-white/20'
                  }`}
                >
                  W{weekNum}
                </span>

                {/* Day cells */}
                <div className="grid grid-cols-7 gap-1 sm:gap-2 md:gap-3 flex-1 w-full items-center">
                  {row.map((day) => {
                    const status = getDayStatus(day)
                    const gate = isGate(day)
                    const retro = isRetro(day)
                    const clickable = isClickable(day)
                    const slug = getDaySlug(day, gateDays, retroEveryN)

                    const cellContent = (
                      <div
                        className={`
                          relative flex items-center justify-center transition-all duration-200
                          w-full h-8 sm:h-10 md:h-12 lg:h-14 rounded-lg
                          ${gate ? 'border-2' : ''}
                          ${status === 'completed'
                            ? gate
                              ? 'bg-[#a855f7]/20 border-[#a855f7]/60'
                              : 'bg-[#2CB1A1]/20 border border-[#2CB1A1]/30'
                            : ''
                          }
                          ${status === 'current'
                            ? gate
                              ? 'bg-[#ffcc00]/20 border-[#ffcc00] animate-pulse shadow-[0_0_12px_rgba(228,185,77,0.3)]'
                              : 'bg-[#ffcc00]/20 border-2 border-[#ffcc00] animate-pulse shadow-[0_0_12px_rgba(228,185,77,0.3)]'
                            : ''
                          }
                          ${status === 'missed'
                            ? gate
                              ? 'bg-[#C96A4A]/20 border-[#C96A4A]/50'
                              : 'bg-[#C96A4A]/20 border border-[#C96A4A]/30'
                            : ''
                          }
                          ${status === 'future'
                            ? gate
                              ? 'bg-[#a855f7]/[0.05] border-[#a855f7]/30 shadow-[inset_0_0_10px_rgba(168,85,247,0.1)]'
                              : 'bg-white/[0.04] border border-white/[0.06]'
                            : ''
                          }
                          ${clickable ? 'cursor-pointer hover:scale-110 hover:brightness-125' : 'cursor-default'}
                        `}
                      >
                        <span
                          className={`
                            text-[11px] font-medium leading-none select-none flex items-center justify-center gap-1.5
                            ${status === 'completed' ? (gate ? 'text-[#a855f7]' : 'text-[#2CB1A1]') : ''}
                            ${status === 'current' ? 'text-[#ffcc00] font-bold' : ''}
                            ${status === 'missed' ? 'text-[#C96A4A]' : ''}
                            ${status === 'future' ? (gate ? 'text-[#a855f7]/50' : 'text-white/20') : ''}
                          `}
                        >
                          {retro ? 'R' : day}
                          {gate && (
                            <span className={`w-1.5 h-1.5 rotate-45 rounded-[1px] ${
                              status === 'completed' ? 'bg-[#a855f7]' :
                              status === 'current' ? 'bg-[#ffcc00]' :
                              status === 'missed' ? 'bg-[#C96A4A]' :
                              'bg-[#a855f7]/40'
                            }`} />
                          )}
                        </span>
                      </div>
                    )

                    if (clickable) {
                      return (
                        <Link
                          key={day}
                          href={slug}
                          className="block w-full flex justify-center"
                        >
                          {cellContent}
                        </Link>
                      )
                    }

                    return (
                      <div key={day} className="w-full flex justify-center">
                        {cellContent}
                      </div>
                    )
                  })}

                  {/* Fill remaining cells if row is short */}
                  {row.length < 7 &&
                    Array.from({ length: 7 - row.length }).map((_, i) => (
                      <div key={`empty-${i}`} className="w-full h-8 sm:h-10" />
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
          <span className="w-3.5 h-2.5 rounded-sm bg-[#a855f7]/20 border-2 border-[#a855f7]/50 flex items-center justify-center">
            <span className="w-1 h-1 rotate-45 bg-[#a855f7]/80 rounded-[1px]" />
          </span>
          <span className="text-[10px] text-white/30">Gate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-[7px] text-white/30">R</span>
          <span className="text-[10px] text-white/30">Retro</span>
        </div>
      </div>
    </div>
  )
}
