const DEFAULT_EMAIL_VERIFICATION_TTL_HOURS = 48
const DEFAULT_EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS = 180

function parseEmailVerificationTtlHours(): number {
  const rawValue =
    process.env.NEXT_PUBLIC_EMAIL_VERIFICATION_TTL_HOURS ||
    process.env.EMAIL_VERIFICATION_TTL_HOURS

  const parsedValue = Number(rawValue)

  if (Number.isFinite(parsedValue) && parsedValue >= 1) {
    return parsedValue
  }

  return DEFAULT_EMAIL_VERIFICATION_TTL_HOURS
}

export const EMAIL_VERIFICATION_TTL_HOURS = parseEmailVerificationTtlHours()
export const EMAIL_VERIFICATION_TTL_MS = EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000

function parseEmailVerificationResendCooldownSeconds(): number {
  const rawValue =
    process.env.NEXT_PUBLIC_EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS ||
    process.env.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS

  const parsedValue = Number(rawValue)

  if (Number.isFinite(parsedValue) && parsedValue >= 1) {
    return parsedValue
  }

  return DEFAULT_EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS
}

export const EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS =
  parseEmailVerificationResendCooldownSeconds()
export const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS =
  EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS * 1000
