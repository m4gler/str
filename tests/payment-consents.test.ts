import { describe, expect, it } from 'vitest'
import { validatePaymentConsents } from '@/lib/paymentFlow'

describe('validatePaymentConsents', () => {
  it('rejects when terms or privacy are missing', () => {
    const result = validatePaymentConsents(
      {
        acceptedTerms: false,
        acceptedPrivacy: true,
        acceptedWithdrawal: true,
      },
      true,
    )

    expect(result).toContain('Terms of Use')
  })

  it('requires withdrawal consent for paid digital access', () => {
    const result = validatePaymentConsents(
      {
        acceptedTerms: true,
        acceptedPrivacy: true,
        acceptedWithdrawal: false,
      },
      true,
    )

    expect(result).toContain('immediate access')
  })

  it('does not require withdrawal consent for free access', () => {
    const result = validatePaymentConsents(
      {
        acceptedTerms: true,
        acceptedPrivacy: true,
        acceptedWithdrawal: false,
      },
      false,
    )

    expect(result).toBeNull()
  })
})
