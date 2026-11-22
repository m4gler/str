'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  parseCertificatePolicy,
  resolveCertificateEligibility,
  type CertificateKind,
  type CertificatePolicy,
} from '@/lib/certificates'

type CertificateData = {
  fullName?: string | null
  companyName?: string | null
  roleTitle?: string | null
  city?: string | null
  country?: string | null
  consentGrantedAt?: string | null
  profileConfirmedAt?: string | null
  missedSessions?: number | null
  hadWeekOff?: boolean | null
  kind?: CertificateKind | null
  resolvedAt?: string | null
  resolvedBy?: number | { id?: number } | null
}

type CertificateAttempt = {
  id: number
  status: 'completed' | 'failed' | string
  attemptNumber?: number | null
  endedAt?: string | null
  updatedAt?: string | null
  user?: {
    id?: number
    email?: string | null
    companyName?: string | null
  } | number | null
  certificate?: CertificateData | null
}

type EditableCertificateRow = {
  missedSessions: number
  hadWeekOff: boolean
}

type FilterKind = 'all' | CertificateKind | 'missing_profile'
type AssignmentKind = 'auto' | CertificateKind

const badgeColors: Record<CertificateKind, { bg: string; border: string; color: string }> = {
  completion: { bg: '#2CB1A114', border: '#2CB1A144', color: '#188f82' },
  participation: { bg: '#ffcc0018', border: '#ffcc0055', color: '#9a7415' },
  none: { bg: '#C96A4A14', border: '#C96A4A44', color: '#a24f35' },
}

const EMPTY_CERTIFICATE: CertificateData = {
  fullName: null,
  companyName: null,
  roleTitle: null,
  city: null,
  country: null,
  consentGrantedAt: null,
  profileConfirmedAt: null,
  missedSessions: 0,
  hadWeekOff: false,
  kind: null,
  resolvedAt: null,
  resolvedBy: null,
}

function getUserEmail(attempt: CertificateAttempt) {
  return typeof attempt.user === 'object' ? attempt.user?.email || '' : ''
}

function getUserCompany(attempt: CertificateAttempt) {
  const userCompany = typeof attempt.user === 'object' ? attempt.user?.companyName || '' : ''
  return attempt.certificate?.companyName || userCompany
}

function hasCertificateData(certificate?: CertificateData | null) {
  if (!certificate) return false

  return Boolean(
    certificate.fullName ||
    certificate.companyName ||
    certificate.roleTitle ||
    certificate.city ||
    certificate.country ||
    certificate.consentGrantedAt ||
    certificate.profileConfirmedAt ||
    certificate.kind ||
    certificate.resolvedAt ||
    getRelationshipId(certificate.resolvedBy) ||
    (Number(certificate.missedSessions ?? 0) || 0) > 0 ||
    certificate.hadWeekOff === true,
  )
}

function isCertificateRelevantAttempt(attempt: CertificateAttempt) {
  return ['completed', 'failed'].includes(attempt.status) || Boolean(attempt.certificate?.kind || attempt.certificate?.profileConfirmedAt)
}

function getAttemptLabel(attempt: CertificateAttempt) {
  const email = getUserEmail(attempt) || `Attempt ${attempt.id}`
  const number = attempt.attemptNumber ? `#${attempt.attemptNumber}` : `ID ${attempt.id}`
  return `${email} - ${number} - ${attempt.status}`
}

function getInitialRows(attempts: CertificateAttempt[]): Record<number, EditableCertificateRow> {
  return attempts.reduce<Record<number, EditableCertificateRow>>((acc, attempt) => {
    acc[attempt.id] = {
      missedSessions: Math.max(0, Number(attempt.certificate?.missedSessions ?? 0) || 0),
      hadWeekOff: attempt.certificate?.hadWeekOff === true,
    }
    return acc
  }, {})
}

function getRelationshipId(value: number | { id?: number } | null | undefined) {
  return typeof value === 'object' ? value?.id ?? null : value ?? null
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

function buildCsv(attempts: CertificateAttempt[], policy: CertificatePolicy, rows: Record<number, EditableCertificateRow>) {
  const headers = [
    'attempt_id',
    'email',
    'status',
    'certificate_kind',
    'missed_sessions',
    'had_week_off',
    'full_name',
    'company_name',
    'role_title',
    'country',
    'city',
    'profile_confirmed_at',
  ]

  const lines = attempts.map((attempt) => {
    const row = rows[attempt.id] || { missedSessions: 0, hadWeekOff: false }
    const resolution = resolveCertificateEligibility(
      {
        completedProgram: attempt.status === 'completed',
        missedSessions: row.missedSessions,
        hadWeekOff: row.hadWeekOff,
      },
      policy,
    )
    const cert = attempt.certificate || {}
    return [
      attempt.id,
      getUserEmail(attempt),
      attempt.status,
      resolution.kind,
      row.missedSessions,
      row.hadWeekOff ? 'yes' : 'no',
      cert.fullName || '',
      cert.companyName || '',
      cert.roleTitle || '',
      cert.country || '',
      cert.city || '',
      cert.profileConfirmedAt || '',
    ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')
  })

  return [headers.join(','), ...lines].join('\n')
}

export function CertificatesView() {
  const [attempts, setAttempts] = useState<CertificateAttempt[]>([])
  const [policy, setPolicy] = useState<CertificatePolicy | null>(null)
  const [rows, setRows] = useState<Record<number, EditableCertificateRow>>({})
  const [loading, setLoading] = useState(true)
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [kindFilter, setKindFilter] = useState<FilterKind>('all')
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [assignmentAttemptId, setAssignmentAttemptId] = useState<number | null>(null)
  const [assignmentKind, setAssignmentKind] = useState<AssignmentKind>('auto')
  const [assignmentFullName, setAssignmentFullName] = useState('')
  const [assignmentCompanyName, setAssignmentCompanyName] = useState('')
  const [assignmentRoleTitle, setAssignmentRoleTitle] = useState('')
  const [assignmentCountry, setAssignmentCountry] = useState('')
  const [assignmentCity, setAssignmentCity] = useState('')
  const [assignmentMissedSessions, setAssignmentMissedSessions] = useState(0)
  const [assignmentHadWeekOff, setAssignmentHadWeekOff] = useState(false)
  const [assignmentSaving, setAssignmentSaving] = useState(false)
  const [assignmentAction, setAssignmentAction] = useState<'assign' | 'remove' | null>(null)
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dayProgramResult, attemptsResult] = await Promise.allSettled([
        fetch('/api/globals/day-program?depth=0').then(async (res) => {
          if (!res.ok) return null
          return res.json()
        }),
        fetch('/api/attempts?limit=500&depth=2&sort=-updatedAt').then(async (res) => {
          if (!res.ok) throw new Error('Failed to load certificate attempts')
          return res.json()
        }),
      ])

      if (attemptsResult.status !== 'fulfilled') {
        throw attemptsResult.reason instanceof Error
          ? attemptsResult.reason
          : new Error('Failed to load certificate attempts')
      }

      const dayProgramData = dayProgramResult.status === 'fulfilled' ? dayProgramResult.value : null
      const attemptsData = attemptsResult.value
      const docs = (attemptsData.docs || []) as CertificateAttempt[]
      setPolicy(parseCertificatePolicy(dayProgramData))
      setAttempts(docs)
      setRows(getInitialRows(docs))
      setAssignmentAttemptId((prev) => prev ?? docs.find(isCertificateRelevantAttempt)?.id ?? docs[0]?.id ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load certificates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const res = await fetch('/api/users/me')
        const data = await res.json()
        if (data.user?.id) setCurrentUserId(data.user.id)
      } catch {
        // The certificate update still works without resolvedBy if this request fails.
      }
    }

    void fetchCurrentUser()
  }, [])

  const certificateAttempts = useMemo(
    () => attempts.filter(isCertificateRelevantAttempt),
    [attempts],
  )

  const selectedAssignmentAttempt = useMemo(
    () => attempts.find((attempt) => attempt.id === assignmentAttemptId) || null,
    [assignmentAttemptId, attempts],
  )

  const stats = useMemo(() => {
    if (!policy) {
      return { completion: 0, participation: 0, none: 0, missingProfile: 0 }
    }

    return certificateAttempts.reduce(
      (acc, attempt) => {
        const row = rows[attempt.id] || { missedSessions: 0, hadWeekOff: false }
        const resolution = resolveCertificateEligibility(
          {
            completedProgram: attempt.status === 'completed',
            missedSessions: row.missedSessions,
            hadWeekOff: row.hadWeekOff,
          },
          policy,
        )
        acc[resolution.kind]++
        if (!attempt.certificate?.profileConfirmedAt) acc.missingProfile++
        return acc
      },
      { completion: 0, participation: 0, none: 0, missingProfile: 0 },
    )
  }, [certificateAttempts, policy, rows])

  const filteredAttempts = useMemo(() => {
    if (!policy) return []

    const query = searchQuery.trim().toLowerCase()
    return certificateAttempts.filter((attempt) => {
      const row = rows[attempt.id] || { missedSessions: 0, hadWeekOff: false }
      const resolution = resolveCertificateEligibility(
        {
          completedProgram: attempt.status === 'completed',
          missedSessions: row.missedSessions,
          hadWeekOff: row.hadWeekOff,
        },
        policy,
      )

      if (kindFilter === 'missing_profile' && attempt.certificate?.profileConfirmedAt) return false
      if (kindFilter !== 'all' && kindFilter !== 'missing_profile' && resolution.kind !== kindFilter) return false
      if (!query) return true

      const haystack = [
        getUserEmail(attempt),
        getUserCompany(attempt),
        attempt.certificate?.fullName,
        attempt.certificate?.roleTitle,
        attempt.certificate?.country,
      ].filter(Boolean).join(' ').toLowerCase()

      return haystack.includes(query)
    })
  }, [certificateAttempts, kindFilter, policy, rows, searchQuery])

  useEffect(() => {
    const attempt = selectedAssignmentAttempt
    if (!attempt) return

    const cert = attempt.certificate || {}
    setAssignmentFullName(cert.fullName || getUserEmail(attempt))
    setAssignmentCompanyName(cert.companyName || getUserCompany(attempt))
    setAssignmentRoleTitle(cert.roleTitle || '')
    setAssignmentCountry(cert.country || '')
    setAssignmentCity(cert.city || '')
    setAssignmentMissedSessions(Math.max(0, Number(cert.missedSessions ?? 0) || 0))
    setAssignmentHadWeekOff(cert.hadWeekOff === true)
    setAssignmentKind(cert.kind || 'auto')
    setAssignmentMessage(null)
  }, [selectedAssignmentAttempt])

  async function saveAttempt(attempt: CertificateAttempt) {
    if (!policy) return

    const row = rows[attempt.id] || { missedSessions: 0, hadWeekOff: false }
    const resolution = resolveCertificateEligibility(
      {
        completedProgram: attempt.status === 'completed',
        missedSessions: row.missedSessions,
        hadWeekOff: row.hadWeekOff,
      },
      policy,
    )

    setSavingIds((prev) => new Set(prev).add(attempt.id))
    setError(null)
    try {
      const certificate = {
        ...(attempt.certificate || {}),
        missedSessions: row.missedSessions,
        hadWeekOff: row.hadWeekOff,
        kind: resolution.kind,
        resolvedAt: new Date().toISOString(),
        resolvedBy: currentUserId || getRelationshipId(attempt.certificate?.resolvedBy) || null,
      }

      const res = await fetch(`/api/attempts/${attempt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certificate }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.errors?.[0]?.message || 'Failed to save certificate data')
      }

      const updated = await res.json()
      const updatedCertificate = updated?.doc?.certificate || updated?.certificate || certificate
      setAttempts((prev) => prev.map((item) => item.id === attempt.id ? { ...item, certificate: updatedCertificate } : item))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save certificate data')
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev)
        next.delete(attempt.id)
        return next
      })
    }
  }

  async function createOrAssignCertificate() {
    if (!policy || !selectedAssignmentAttempt) return

    const fullName = assignmentFullName.trim()
    const companyName = assignmentCompanyName.trim()
    const roleTitle = assignmentRoleTitle.trim()
    const country = assignmentCountry.trim()
    const city = assignmentCity.trim()

    if (!fullName || !companyName || !roleTitle || !country) {
      setError('Full name, company name, role/title, and country are required.')
      return
    }

    const autoResolution = resolveCertificateEligibility(
      {
        completedProgram: selectedAssignmentAttempt.status === 'completed',
        missedSessions: assignmentMissedSessions,
        hadWeekOff: assignmentHadWeekOff,
      },
      policy,
    )
    const resolvedKind = assignmentKind === 'auto' ? autoResolution.kind : assignmentKind
    const now = new Date().toISOString()
    const existingCertificate = selectedAssignmentAttempt.certificate || {}
    const certificate: CertificateData = {
      ...existingCertificate,
      fullName,
      companyName,
      roleTitle,
      country,
      city: city || null,
      missedSessions: assignmentMissedSessions,
      hadWeekOff: assignmentHadWeekOff,
      kind: resolvedKind,
      consentGrantedAt: existingCertificate.consentGrantedAt || now,
      profileConfirmedAt: now,
      resolvedAt: now,
      resolvedBy: currentUserId || getRelationshipId(existingCertificate.resolvedBy) || null,
    }

    setAssignmentSaving(true)
    setAssignmentAction('assign')
    setError(null)
    setAssignmentMessage(null)
    try {
      const res = await fetch(`/api/attempts/${selectedAssignmentAttempt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certificate }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.errors?.[0]?.message || 'Failed to assign certificate')
      }

      const updated = await res.json()
      const updatedCertificate = updated?.doc?.certificate || updated?.certificate || certificate
      setAttempts((prev) => prev.map((item) => item.id === selectedAssignmentAttempt.id ? { ...item, certificate: updatedCertificate } : item))
      setRows((prev) => ({
        ...prev,
        [selectedAssignmentAttempt.id]: {
          missedSessions: assignmentMissedSessions,
          hadWeekOff: assignmentHadWeekOff,
        },
      }))
      setAssignmentMessage(`Certificate assigned as ${resolvedKind}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign certificate')
    } finally {
      setAssignmentSaving(false)
      setAssignmentAction(null)
    }
  }

  async function removeCertificate(attempt: CertificateAttempt) {
    const label = attempt.certificate?.fullName || getUserEmail(attempt) || `attempt ${attempt.id}`
    const confirmed = window.confirm(`Remove certificate data for ${label}?`)
    if (!confirmed) return

    setSavingIds((prev) => new Set(prev).add(attempt.id))
    setError(null)
    setAssignmentMessage(null)

    if (assignmentAttemptId === attempt.id) {
      setAssignmentSaving(true)
      setAssignmentAction('remove')
    }

    try {
      const res = await fetch(`/api/attempts/${attempt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certificate: EMPTY_CERTIFICATE }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.errors?.[0]?.message || 'Failed to remove certificate')
      }

      const updated = await res.json().catch(() => null)
      const updatedCertificate = updated?.doc?.certificate || updated?.certificate || EMPTY_CERTIFICATE
      setAttempts((prev) => prev.map((item) => item.id === attempt.id ? { ...item, certificate: updatedCertificate } : item))
      setRows((prev) => ({
        ...prev,
        [attempt.id]: {
          missedSessions: 0,
          hadWeekOff: false,
        },
      }))

      if (assignmentAttemptId === attempt.id) {
        setAssignmentMessage('Certificate removed.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove certificate')
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev)
        next.delete(attempt.id)
        return next
      })

      if (assignmentAttemptId === attempt.id) {
        setAssignmentSaving(false)
        setAssignmentAction(null)
      }
    }
  }

  function updateRow(id: number, patch: Partial<EditableCertificateRow>) {
    setRows((prev) => ({
      ...prev,
      [id]: {
        missedSessions: Math.max(0, Number(prev[id]?.missedSessions ?? 0) || 0),
        hadWeekOff: prev[id]?.hadWeekOff === true,
        ...patch,
      },
    }))
  }

  function exportCsv() {
    if (!policy) return
    const csv = buildCsv(filteredAttempts, policy, rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `mesga-certificates-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 18, color: 'var(--theme-elevation-700)' }}>Loading certificates...</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 30px', maxWidth: 1500, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4, color: 'var(--theme-text)' }}>Certificates</h1>
          <p style={{ color: 'var(--theme-elevation-700)', fontSize: 14, maxWidth: 760 }}>
            Review ended attempts, adjust session-based eligibility inputs, and save the resolved completion or participation certificate state.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={fetchData} style={secondaryButtonStyle}>Refresh</button>
          <button onClick={exportCsv} disabled={!policy || filteredAttempts.length === 0} style={primaryButtonStyle}>Export CSV</button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 20, padding: 14, borderRadius: 8, border: '1px solid #C96A4A55', background: '#C96A4A12', color: '#9f3e2c' }}>
          {error}
        </div>
      )}

      {policy && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
          <StatCard label="Completion" value={stats.completion} color="#2CB1A1" />
          <StatCard label="Participation" value={stats.participation} color="#ffcc00" />
          <StatCard label="No Certificate" value={stats.none} color="#C96A4A" />
          <StatCard label="Missing Profile" value={stats.missingProfile} color="#ffcc00" />
          <StatCard label="Miss Threshold" value={policy.missedSessionsThreshold} color="#666" />
        </div>
      )}

      <div style={{ marginBottom: 24, padding: 18, borderRadius: 10, border: '1px solid var(--theme-elevation-150)', background: 'var(--theme-elevation-50)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Create / assign certificate</h2>
            <p style={{ margin: '5px 0 0', color: 'var(--theme-elevation-700)', fontSize: 13 }}>
              Create certificate data on an existing attempt and assign the resolved or manually selected certificate type.
            </p>
          </div>
          {assignmentMessage && (
            <div style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid #2CB1A144', background: '#2CB1A114', color: '#188f82', fontSize: 12, fontWeight: 700 }}>
              {assignmentMessage}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 2fr) 170px 140px 130px', gap: 12, marginBottom: 12 }}>
          <label style={fieldLabelStyle}>
            Attempt
            <select
              value={assignmentAttemptId ?? ''}
              onChange={(e) => setAssignmentAttemptId(e.target.value ? Number(e.target.value) : null)}
              style={inputStyle}
            >
              <option value="">Select attempt...</option>
              {attempts.map((attempt) => (
                <option key={attempt.id} value={attempt.id}>
                  {getAttemptLabel(attempt)}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldLabelStyle}>
            Certificate type
            <select value={assignmentKind} onChange={(e) => setAssignmentKind(e.target.value as AssignmentKind)} style={inputStyle}>
              <option value="auto">Auto from policy</option>
              <option value="completion">Completion</option>
              <option value="participation">Participation</option>
              <option value="none">No certificate</option>
            </select>
          </label>

          <label style={fieldLabelStyle}>
            Missed sessions
            <input
              type="number"
              min={0}
              value={assignmentMissedSessions}
              onChange={(e) => setAssignmentMissedSessions(Math.max(0, Number(e.target.value) || 0))}
              style={inputStyle}
            />
          </label>

          <label style={{ ...fieldLabelStyle, justifyContent: 'flex-end', paddingBottom: 8 }}>
            <span>Week off</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--theme-text)' }}>
              <input
                type="checkbox"
                checked={assignmentHadWeekOff}
                onChange={(e) => setAssignmentHadWeekOff(e.target.checked)}
              />
              Yes
            </span>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(140px, 1fr))', gap: 12 }}>
          <label style={fieldLabelStyle}>
            Full name
            <input value={assignmentFullName} onChange={(e) => setAssignmentFullName(e.target.value)} style={inputStyle} />
          </label>
          <label style={fieldLabelStyle}>
            Company
            <input value={assignmentCompanyName} onChange={(e) => setAssignmentCompanyName(e.target.value)} style={inputStyle} />
          </label>
          <label style={fieldLabelStyle}>
            Role / title
            <input value={assignmentRoleTitle} onChange={(e) => setAssignmentRoleTitle(e.target.value)} style={inputStyle} />
          </label>
          <label style={fieldLabelStyle}>
            Country
            <input value={assignmentCountry} onChange={(e) => setAssignmentCountry(e.target.value)} style={inputStyle} />
          </label>
          <label style={fieldLabelStyle}>
            City
            <input value={assignmentCity} onChange={(e) => setAssignmentCity(e.target.value)} style={inputStyle} />
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginTop: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--theme-elevation-700)' }}>
            {selectedAssignmentAttempt && policy
              ? `Auto result now: ${resolveCertificateEligibility({
                  completedProgram: selectedAssignmentAttempt.status === 'completed',
                  missedSessions: assignmentMissedSessions,
                  hadWeekOff: assignmentHadWeekOff,
                }, policy).kind}`
              : 'Select an attempt to assign certificate data.'}
          </div>
          <button
            onClick={createOrAssignCertificate}
            disabled={!selectedAssignmentAttempt || assignmentSaving}
            style={!selectedAssignmentAttempt || assignmentSaving ? disabledButtonStyle : primaryButtonStyle}
          >
            {assignmentSaving && assignmentAction === 'assign' ? 'Assigning...' : 'Create / assign certificate'}
          </button>
          <button
            onClick={() => selectedAssignmentAttempt && void removeCertificate(selectedAssignmentAttempt)}
            disabled={!selectedAssignmentAttempt || assignmentSaving || !hasCertificateData(selectedAssignmentAttempt?.certificate)}
            style={!selectedAssignmentAttempt || assignmentSaving || !hasCertificateData(selectedAssignmentAttempt?.certificate) ? disabledSecondaryButtonStyle : subtleDangerButtonStyle}
          >
            {assignmentSaving && assignmentAction === 'remove' ? 'Removing...' : 'Remove certificate'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) 220px', gap: 12, marginBottom: 18 }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search email, name, company, role, country..."
          style={inputStyle}
        />
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as FilterKind)} style={inputStyle}>
          <option value="all">All certificates</option>
          <option value="completion">Completion</option>
          <option value="participation">Participation</option>
          <option value="none">No certificate</option>
          <option value="missing_profile">Missing profile data</option>
        </select>
      </div>

      <div style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 10, overflow: 'hidden', background: 'var(--theme-elevation-0)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1.4fr) 120px 170px 150px 130px 170px', gap: 12, padding: '12px 16px', background: 'var(--theme-elevation-50)', borderBottom: '1px solid var(--theme-elevation-150)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--theme-elevation-800)' }}>
          <div>Participant</div>
          <div>Attempt</div>
          <div>Eligibility</div>
          <div>Sessions</div>
          <div>Week off</div>
          <div>Actions</div>
        </div>

        {filteredAttempts.map((attempt) => {
          const row = rows[attempt.id] || { missedSessions: 0, hadWeekOff: false }
          const resolution = policy
            ? resolveCertificateEligibility(
                {
                  completedProgram: attempt.status === 'completed',
                  missedSessions: row.missedSessions,
                  hadWeekOff: row.hadWeekOff,
                },
                policy,
              )
            : { kind: 'none' as CertificateKind, label: null, reason: 'disabled' as const }
          const badge = badgeColors[resolution.kind]
          const saving = savingIds.has(attempt.id)
          const profileMissing = !attempt.certificate?.profileConfirmedAt

          return (
            <div key={attempt.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1.4fr) 120px 170px 150px 130px 170px', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--theme-elevation-100)', alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {attempt.certificate?.fullName || getUserEmail(attempt) || `Attempt ${attempt.id}`}
                </div>
                <div style={{ marginTop: 3, fontSize: 12, color: 'var(--theme-elevation-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getUserEmail(attempt)}
                  {getUserCompany(attempt) ? ` - ${getUserCompany(attempt)}` : ''}
                </div>
                <div style={{ marginTop: 5, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {attempt.certificate?.roleTitle && <SmallPill>{attempt.certificate.roleTitle}</SmallPill>}
                  {attempt.certificate?.country && <SmallPill>{attempt.certificate.country}</SmallPill>}
                  {profileMissing && <SmallPill tone="warning">profile missing</SmallPill>}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{attempt.status}</div>
                <div style={{ fontSize: 11, color: 'var(--theme-elevation-700)', marginTop: 3 }}>#{attempt.attemptNumber || '-'}</div>
                <div style={{ fontSize: 11, color: 'var(--theme-elevation-700)', marginTop: 3 }}>{formatDate(attempt.endedAt)}</div>
              </div>

              <div>
                <span style={{ display: 'inline-flex', padding: '5px 10px', borderRadius: 999, border: `1px solid ${badge.border}`, background: badge.bg, color: badge.color, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  {resolution.kind}
                </span>
                <div style={{ marginTop: 5, fontSize: 11, color: 'var(--theme-elevation-700)' }}>{resolution.reason}</div>
              </div>

              <div>
                <input
                  type="number"
                  min={0}
                  value={row.missedSessions}
                  onChange={(e) => updateRow(attempt.id, { missedSessions: Math.max(0, Number(e.target.value) || 0) })}
                  style={{ ...inputStyle, width: 96 }}
                />
              </div>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={row.hadWeekOff}
                  onChange={(e) => updateRow(attempt.id, { hadWeekOff: e.target.checked })}
                />
                Yes
              </label>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={() => saveAttempt(attempt)}
                  disabled={saving}
                  style={saving ? disabledButtonStyle : primaryButtonStyle}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => void removeCertificate(attempt)}
                  disabled={saving || !hasCertificateData(attempt.certificate)}
                  style={saving || !hasCertificateData(attempt.certificate) ? disabledSecondaryButtonStyle : subtleDangerButtonStyle}
                >
                  Remove
                </button>
                <a href={`/admin/collections/attempts/${attempt.id}`} style={linkStyle}>Open</a>
              </div>
            </div>
          )
        })}

        {filteredAttempts.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--theme-elevation-700)', fontSize: 14 }}>
            No certificate attempts match the current filters.
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, fontSize: 12, color: 'var(--theme-elevation-700)' }}>
        Policy: certificates {policy?.enabled ? 'enabled' : 'disabled'}, threshold {policy?.missedSessionsThreshold ?? '-'} missed sessions, week off {policy?.weekOffDisqualifies ? 'disqualifies' : 'does not disqualify'}.
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--theme-elevation-150)', background: 'var(--theme-elevation-50)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--theme-elevation-800)', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
    </div>
  )
}

function SmallPill({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'warning' }) {
  return (
    <span style={{
      display: 'inline-flex',
      padding: '3px 8px',
      borderRadius: 999,
      border: tone === 'warning' ? '1px solid #ffcc0055' : '1px solid var(--theme-elevation-200)',
      background: tone === 'warning' ? '#ffcc0014' : 'var(--theme-elevation-50)',
      color: tone === 'warning' ? '#8b6812' : 'var(--theme-elevation-700)',
      fontSize: 11,
      fontWeight: 600,
    }}>
      {children}
    </span>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: 7,
  border: '1px solid var(--theme-elevation-250)',
  background: 'var(--theme-elevation-0)',
  color: 'var(--theme-text)',
  fontSize: 13,
  outline: 'none',
}

const fieldLabelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  color: 'var(--theme-elevation-650)',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.7,
}

const primaryButtonStyle: React.CSSProperties = {
  padding: '9px 14px',
  borderRadius: 7,
  border: '1px solid #ffcc0033',
  background: '#ffcc00',
  color: 'white',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '9px 14px',
  borderRadius: 7,
  border: '1px solid var(--theme-elevation-250)',
  background: 'var(--theme-elevation-0)',
  color: 'var(--theme-text)',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
}

const subtleDangerButtonStyle: React.CSSProperties = {
  padding: '9px 14px',
  borderRadius: 7,
  border: '1px solid rgba(201, 106, 74, 0.22)',
  background: 'var(--theme-elevation-0)',
  color: '#b25335',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
}

const disabledButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  opacity: 0.55,
  cursor: 'not-allowed',
}

const disabledSecondaryButtonStyle: React.CSSProperties = {
  ...subtleDangerButtonStyle,
  opacity: 0.55,
  cursor: 'not-allowed',
}

const linkStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#ffcc00',
  textDecoration: 'none',
}

export default CertificatesView
