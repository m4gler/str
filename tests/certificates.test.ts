import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CERTIFICATE_POLICY,
  extractCertificateProfileFromIntake,
  parseCertificatePolicy,
  resolveCertificateEligibility,
} from '@/lib/certificates'

describe('certificates', () => {
  it('uses payload-managed policy values when present', () => {
    const policy = parseCertificatePolicy({
      certificatePolicy: {
        enabled: true,
        missedSessionsThreshold: 4,
        weekOffDisqualifies: false,
        completionLabel: 'finish',
        participationLabel: 'participated',
      },
    })

    expect(policy).toEqual({
      enabled: true,
      missedSessionsThreshold: 4,
      weekOffDisqualifies: false,
      completionLabel: 'finish',
      participationLabel: 'participated',
      showOnDashboard: false,
      emailPdfEnabled: false,
    })
  })

  it('keeps dashboard display and certificate email disabled unless payload enables them', () => {
    expect(parseCertificatePolicy({}).showOnDashboard).toBe(false)
    expect(parseCertificatePolicy({}).emailPdfEnabled).toBe(false)

    const policy = parseCertificatePolicy({
      certificatePolicy: {
        showOnDashboard: true,
        emailPdfEnabled: true,
      },
    })

    expect(policy.showOnDashboard).toBe(true)
    expect(policy.emailPdfEnabled).toBe(true)
  })

  it('extracts certificate profile details from founder intake answers', () => {
    const profile = extractCertificateProfileFromIntake({
      F6_FULL_NAME: ' Ada Founder ',
      F1_COMPANY_NAME: ' MESGA Labs ',
      F6_ROLE_EXPECTED: 'Other',
      F6_ROLE_OTHER: 'Chief Builder',
      F2_CURRENT_COUNTRY: 'Poland',
      F2_CURRENT_CITY: 'Warsaw',
      F2_RESIDENCY_COUNTRY: 'Germany',
      F2_RESIDENCY_CITY: 'Berlin',
    })

    expect(profile).toEqual({
      fullName: 'Ada Founder',
      companyName: 'MESGA Labs',
      roleTitle: 'Chief Builder',
      country: 'Poland',
      city: 'Warsaw',
    })
  })

  it('falls back to alternate intake fields for company and location', () => {
    const profile = extractCertificateProfileFromIntake({
      F6_FULL_NAME: 'Ada Founder',
      F7B_STARTUP_NAME: 'Existing Startup',
      F6_ROLE_EXPECTED: 'CEO',
      F7B_HQ_COUNTRY: 'Estonia',
      F7B_HQ_CITY: 'Tallinn',
    })

    expect(profile).toEqual({
      fullName: 'Ada Founder',
      companyName: 'Existing Startup',
      roleTitle: 'CEO',
      country: 'Estonia',
      city: 'Tallinn',
    })
  })

  it('disqualifies certificates after a week off', () => {
    const result = resolveCertificateEligibility(
      { completedProgram: true, missedSessions: 0, hadWeekOff: true },
      DEFAULT_CERTIFICATE_POLICY,
    )

    expect(result).toEqual({
      kind: 'none',
      label: null,
      reason: 'week_off',
    })
  })

  it('downgrades to participation when the miss threshold is reached', () => {
    const result = resolveCertificateEligibility(
      { completedProgram: true, missedSessions: 3, hadWeekOff: false },
      DEFAULT_CERTIFICATE_POLICY,
    )

    expect(result.kind).toBe('participation')
    expect(result.label).toBe(DEFAULT_CERTIFICATE_POLICY.participationLabel)
    expect(result.reason).toBe('miss_threshold')
  })

  it('returns completion for completed participants below the threshold', () => {
    const result = resolveCertificateEligibility(
      { completedProgram: true, missedSessions: 2, hadWeekOff: false },
      DEFAULT_CERTIFICATE_POLICY,
    )

    expect(result.kind).toBe('completion')
    expect(result.label).toBe(DEFAULT_CERTIFICATE_POLICY.completionLabel)
    expect(result.reason).toBe('completion')
  })
})
