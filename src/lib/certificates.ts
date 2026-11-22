export type CertificateKind = 'none' | 'participation' | 'completion'

export interface CertificatePolicy {
  enabled: boolean
  missedSessionsThreshold: number
  weekOffDisqualifies: boolean
  completionLabel: string
  participationLabel: string
  showOnDashboard: boolean
  emailPdfEnabled: boolean
}

export interface CertificateProfile {
  fullName: string
  companyName: string
  roleTitle: string
  country: string
  city: string | null
}

export interface CertificateResolutionInput {
  completedProgram: boolean
  missedSessions?: number | null
  hadWeekOff?: boolean | null
}

export interface CertificateResolution {
  kind: CertificateKind
  label: string | null
  reason:
    | 'disabled'
    | 'week_off'
    | 'miss_threshold'
    | 'completion'
    | 'participation'
}

export const DEFAULT_CERTIFICATE_POLICY: CertificatePolicy = {
  enabled: true,
  missedSessionsThreshold: 3,
  weekOffDisqualifies: true,
  completionLabel: 'completion',
  participationLabel: 'participation',
  showOnDashboard: false,
  emailPdfEnabled: false,
}

export function parseCertificatePolicy(dayProgram: any): CertificatePolicy {
  const rawPolicy = dayProgram?.certificatePolicy

  return {
    enabled: rawPolicy?.enabled !== false,
    missedSessionsThreshold:
      typeof rawPolicy?.missedSessionsThreshold === 'number' && rawPolicy.missedSessionsThreshold > 0
        ? rawPolicy.missedSessionsThreshold
        : DEFAULT_CERTIFICATE_POLICY.missedSessionsThreshold,
    weekOffDisqualifies: rawPolicy?.weekOffDisqualifies !== false,
    completionLabel:
      typeof rawPolicy?.completionLabel === 'string' && rawPolicy.completionLabel.trim()
        ? rawPolicy.completionLabel.trim()
        : DEFAULT_CERTIFICATE_POLICY.completionLabel,
    participationLabel:
      typeof rawPolicy?.participationLabel === 'string' && rawPolicy.participationLabel.trim()
        ? rawPolicy.participationLabel.trim()
        : DEFAULT_CERTIFICATE_POLICY.participationLabel,
    showOnDashboard: rawPolicy?.showOnDashboard === true,
    emailPdfEnabled: rawPolicy?.emailPdfEnabled === true,
  }
}

function normalizeAnswer(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeAnswer(item))
      .filter(Boolean)
      .join(', ')
      .trim()
  }

  if (value == null) return ''

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return normalizeAnswer(record.label ?? record.value ?? record.name ?? '')
  }

  return String(value).trim()
}

function firstAnswer(data: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const answer = normalizeAnswer(data[key])
    if (answer && answer.toLowerCase() !== 'tbd') return answer
  }

  return ''
}

export function extractCertificateProfileFromIntake(
  submissionData: Record<string, unknown> | null | undefined,
): CertificateProfile | null {
  const data = submissionData ?? {}
  const fullName = firstAnswer(data, ['F6_FULL_NAME', 'fullName', 'full_name', 'name'])
  const companyName = firstAnswer(data, [
    'F1_COMPANY_NAME',
    'F7B_STARTUP_NAME',
    'F7A_WORKING_NAME',
    'companyName',
    'company_name',
  ])
  const expectedRole = firstAnswer(data, ['F6_ROLE_EXPECTED', 'roleTitle', 'role_title', 'role'])
  const otherRole = firstAnswer(data, ['F6_ROLE_OTHER'])
  const roleTitle = expectedRole.toLowerCase() === 'other' && otherRole ? otherRole : expectedRole
  const country = firstAnswer(data, [
    'F2_CURRENT_COUNTRY',
    'F2_RESIDENCY_COUNTRY',
    'F7B_HQ_COUNTRY',
    'F7A_PLANNED_HQ_COUNTRY',
    'country',
  ])
  const city = firstAnswer(data, [
    'F2_CURRENT_CITY',
    'F2_RESIDENCY_CITY',
    'F7B_HQ_CITY',
    'F7A_PLANNED_HQ_CITY',
    'city',
  ])

  if (!fullName || !companyName || !roleTitle || !country) {
    return null
  }

  return {
    fullName,
    companyName,
    roleTitle,
    country,
    city: city || null,
  }
}

export function resolveCertificateEligibility(
  input: CertificateResolutionInput,
  policy: CertificatePolicy = DEFAULT_CERTIFICATE_POLICY,
): CertificateResolution {
  if (!policy.enabled) {
    return { kind: 'none', label: null, reason: 'disabled' }
  }

  if (policy.weekOffDisqualifies && input.hadWeekOff === true) {
    return { kind: 'none', label: null, reason: 'week_off' }
  }

  const missedSessions = typeof input.missedSessions === 'number' && Number.isFinite(input.missedSessions)
    ? Math.max(0, input.missedSessions)
    : 0

  if (missedSessions >= policy.missedSessionsThreshold) {
    return {
      kind: 'participation',
      label: policy.participationLabel,
      reason: 'miss_threshold',
    }
  }

  if (input.completedProgram) {
    return {
      kind: 'completion',
      label: policy.completionLabel,
      reason: 'completion',
    }
  }

  return {
    kind: 'participation',
    label: policy.participationLabel,
    reason: 'participation',
  }
}
