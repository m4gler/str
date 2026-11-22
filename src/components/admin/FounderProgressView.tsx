'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { getActivePersonalityTestFormId } from '@/lib/personalityTest'
import { buildFounderAnalytics, type FounderAnalyticsResult, type FounderAnalyticsRow } from '@/lib/adminFounderAnalytics'

const PHASE_COLORS: Record<string, string> = {
  mix: '#2CB1A1',
  proof: '#E0C188',
  bake: '#C96A4A',
  glaze: '#ffcc00',
}

function getPhase(day: number): string {
  if (day <= 21) return 'mix'
  if (day <= 49) return 'proof'
  if (day <= 77) return 'bake'
  return 'glaze'
}

function getPhaseColor(day: number): string {
  return PHASE_COLORS[getPhase(day)] || '#666'
}

export function FounderProgressView() {
  const [analytics, setAnalytics] = useState<FounderAnalyticsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedFounder, setSelectedFounder] = useState<FounderAnalyticsRow | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [trackId, setTrackId] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [personality, setPersonality] = useState('')
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [settingsRes, usersRes, subsRes, projectsRes, attemptsRes, partnersRes, tracksRes] = await Promise.all([
        fetch('/api/globals/platform-settings?depth=0'),
        fetch('/api/users?where[role][equals]=founder&limit=1000&depth=1'),
        fetch('/api/founder-form-submissions?limit=10000&depth=1&sort=-createdAt'),
        fetch('/api/project-submissions?limit=10000&depth=2&sort=-createdAt'),
        fetch('/api/attempts?limit=10000&depth=1&sort=-updatedAt'),
        fetch('/api/partners?limit=500&depth=0&sort=name'),
        fetch('/api/tracks?limit=500&depth=0&sort=name'),
      ])

      for (const response of [settingsRes, usersRes, subsRes, projectsRes, attemptsRes, partnersRes, tracksRes]) {
        if (!response.ok) throw new Error(`Failed to fetch ${response.url}`)
      }

      const [settings, usersData, subsData, projectsData, attemptsData, partnersData, tracksData] = await Promise.all([
        settingsRes.json(),
        usersRes.json(),
        subsRes.json(),
        projectsRes.json(),
        attemptsRes.json(),
        partnersRes.json(),
        tracksRes.json(),
      ])

      const nextAnalytics = buildFounderAnalytics({
        users: usersData.docs || [],
        submissions: subsData.docs || [],
        projectSubmissions: projectsData.docs || [],
        attempts: attemptsData.docs || [],
        partners: partnersData.docs || [],
        tracks: tracksData.docs || [],
        settings,
        activePersonalityTestFormId: getActivePersonalityTestFormId(settings),
        filters: {
          query: searchQuery || undefined,
          trackId: trackId || undefined,
          partnerId: partnerId || undefined,
          personality: personality || undefined,
        },
      })

      setAnalytics(nextAnalytics)
      if (selectedFounder && !nextAnalytics.filteredRows.some((row) => row.id === selectedFounder.id)) {
        setSelectedFounder(null)
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [partnerId, personality, searchQuery, selectedFounder, trackId])

  useEffect(() => { fetchData() }, [fetchData])

  const stats = useMemo(() => {
    const rows = analytics?.filteredRows || []
    const totalDays = rows.reduce((sum, row) => sum + row.completedDays.length, 0)
    const oneDayAgo = Date.now() - 86_400_000
    return {
      totalFounders: rows.length,
      avgDay: rows.length > 0 ? Math.round((totalDays / rows.length) * 10) / 10 : 0,
      completedProgram: rows.filter((row) => row.steps.finished).length,
      activeToday: rows.filter((row) => row.lastSubmissionAt && new Date(row.lastSubmissionAt).getTime() > oneDayAgo).length,
    }
  }, [analytics])

  if (loading && !analytics) {
    return <div style={{ padding: 40, color: 'var(--theme-elevation-700)' }}>Loading founder progress data...</div>
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 18, color: '#b42318' }}>Error: {error}</div>
        <button onClick={fetchData} style={{ marginTop: 16, padding: '8px 20px', borderRadius: 6, border: '1px solid var(--theme-elevation-250)', cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    )
  }

  if (!analytics) return null

  return (
    <div style={{ padding: '20px 30px', maxWidth: 1450, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4, color: 'var(--theme-text)' }}>Founder Progress</h1>
        <p style={{ color: 'var(--theme-elevation-700)', fontSize: 14, margin: 0 }}>
          Track founder progress with current program track, personality and partner filters.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(160px, 1fr))', gap: 14, marginBottom: 22 }}>
        <StatCard label="Founders" value={stats.totalFounders} color="#ffcc00" />
        <StatCard label="Avg. Completed Days" value={stats.avgDay} color="#2CB1A1" />
        <StatCard label="Completed Program" value={stats.completedProgram} color="#ffcc00" />
        <StatCard label="Active (24h)" value={stats.activeToday} color="#C96A4A" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search founders by email..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 6,
            border: '1px solid var(--theme-elevation-250)',
            background: 'var(--theme-elevation-0)',
            fontSize: 14,
            outline: 'none',
          }}
        />
        <FilterSelect value={trackId} onChange={setTrackId} options={analytics.trackOptions} emptyLabel="All tracks" />
        <FilterSelect value={personality} onChange={setPersonality} options={analytics.personalityOptions} emptyLabel="All personalities" />
        <FilterSelect value={partnerId} onChange={setPartnerId} options={analytics.partnerOptions} emptyLabel="All partners" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedFounder ? 'minmax(0, 1fr) 440px' : '1fr', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {analytics.filteredRows.map((founder) => (
            <FounderRow
              key={founder.id}
              founder={founder}
              selected={selectedFounder?.id === founder.id}
              onClick={() => setSelectedFounder(founder)}
            />
          ))}
          {analytics.filteredRows.length === 0 && (
            <div style={{ padding: 22, textAlign: 'center', color: 'var(--theme-elevation-700)', fontSize: 14 }}>
              No founders found
            </div>
          )}
        </div>

        {selectedFounder && (
          <FounderDetail founder={selectedFounder} onClose={() => setSelectedFounder(null)} />
        )}
      </div>
    </div>
  )
}

function FounderRow({ founder, selected, onClick }: { founder: FounderAnalyticsRow; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '12px 16px',
        borderRadius: 8,
        border: `1px solid ${selected ? '#ffcc00' : 'var(--theme-elevation-150)'}`,
        background: selected ? 'rgba(255,204,0, 0.06)' : 'var(--theme-elevation-0)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        textAlign: 'left',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {founder.email}
        </div>
        <div style={{ fontSize: 11, color: 'var(--theme-elevation-700)', marginTop: 3, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{founder.programTrackName || 'No track'}</span>
          <span>{founder.personality ? `${founder.personalityEmoji || ''} ${founder.personality}`.trim() : 'No personality'}</span>
          <span>{founder.partnerName || 'No partner'}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ width: 90, height: 6, borderRadius: 3, background: 'var(--theme-elevation-150)', overflow: 'hidden' }}>
          <div style={{ width: `${founder.completedDays.length}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #2CB1A1, #E0C188, #C96A4A, #ffcc00)' }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, color: getPhaseColor(founder.currentDay), minWidth: 54, textAlign: 'right' }}>
          Day {founder.currentDay}
        </span>
      </div>
    </button>
  )
}

function FounderDetail({ founder, onClose }: { founder: FounderAnalyticsRow; onClose: () => void }) {
  return (
    <aside style={{ padding: 22, borderRadius: 8, border: '1px solid var(--theme-elevation-150)', background: 'var(--theme-elevation-50)', position: 'sticky', top: 20, alignSelf: 'start' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 18 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{founder.email}</h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Badge>{founder.programTrackName || 'No track'}</Badge>
            <Badge>{founder.personality ? `${founder.personalityEmoji || ''} ${founder.personality}`.trim() : 'No personality'}</Badge>
            <Badge>{founder.partnerName || 'No partner'}</Badge>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--theme-elevation-700)', padding: 4 }}>
          x
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <MiniStat label="Current Day" value={founder.currentDay} />
        <MiniStat label="Completed" value={`${founder.completedDays.length}/100`} />
        <MiniStat label="Status" value={founder.attemptStatus || founder.programStatus} />
      </div>

      <div style={{ display: 'grid', gap: 7, fontSize: 12, color: 'var(--theme-elevation-700)', marginBottom: 16 }}>
        <div>Latest project: <strong>{founder.latestProjectStatus || 'None'}</strong></div>
        <div>Last activity: <strong>{founder.lastSubmissionAt ? new Date(founder.lastSubmissionAt).toLocaleString('en-US') : 'None'}</strong></div>
      </div>

      <a
        href={`/admin/collections/users/${founder.id}`}
        style={{ display: 'inline-flex', width: '100%', justifyContent: 'center', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--theme-elevation-250)', color: 'var(--theme-text)', textDecoration: 'none', fontWeight: 800, fontSize: 13, marginBottom: 16, background: 'var(--theme-elevation-0)' }}
      >
        Open Payload user profile
      </a>

      <h4 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--theme-elevation-800)', marginBottom: 10 }}>
        100-Day Grid
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 3 }}>
        {Array.from({ length: 100 }, (_, i) => i + 1).map((day) => {
          const completed = founder.completedDays.includes(day)
          const isCurrent = day === founder.currentDay
          const color = PHASE_COLORS[getPhase(day)]
          const submissionId = founder.daySubmissionIds[day]
          const dayStyle: React.CSSProperties = {
            width: '100%',
            aspectRatio: '1',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 8,
            fontWeight: 800,
            border: isCurrent ? `2px solid ${color}` : '1px solid transparent',
            background: completed ? color : isCurrent ? `${color}20` : 'var(--theme-elevation-100)',
            color: completed ? '#fff' : isCurrent ? color : 'var(--theme-elevation-700)',
            textDecoration: 'none',
            cursor: submissionId ? 'pointer' : 'default',
          }

          if (submissionId) {
            return (
              <a
                key={day}
                href={`/admin/collections/founder-form-submissions/${submissionId}`}
                title={`Open Day ${day} submission`}
                style={dayStyle}
              >
                {day}
              </a>
            )
          }

          return (
            <div
              key={day}
              title={`Day ${day}${completed ? ' completed' : isCurrent ? ' current' : ''}`}
              style={dayStyle}
            >
              {day}
            </div>
          )
        })}
      </div>
    </aside>
  )
}

function FilterSelect({ value, onChange, options, emptyLabel }: { value: string; onChange: (value: string) => void; options: Array<{ id: string; label: string }>; emptyLabel: string }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--theme-elevation-250)', background: 'var(--theme-elevation-0)', color: 'var(--theme-text)', fontSize: 13 }}
    >
      <option value="">{emptyLabel}</option>
      {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 999, background: 'var(--theme-elevation-0)', border: '1px solid var(--theme-elevation-200)' }}>
      {children}
    </span>
  )
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ padding: '16px 18px', borderRadius: 8, border: '1px solid var(--theme-elevation-150)', background: 'var(--theme-elevation-0)' }}>
      <div style={{ fontSize: 28, fontWeight: 850, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--theme-elevation-800)', marginTop: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ padding: '10px 8px', borderRadius: 8, background: 'var(--theme-elevation-100)', textAlign: 'center', minWidth: 0 }}>
      <div style={{ fontSize: 16, fontWeight: 850, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--theme-elevation-700)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
    </div>
  )
}

export default FounderProgressView
