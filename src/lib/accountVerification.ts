import type { Payload } from 'payload'
import { randomBytes } from 'crypto'

import { getAppUrl } from '@/lib/appUrl'
import {
  EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
  EMAIL_VERIFICATION_TTL_HOURS,
  EMAIL_VERIFICATION_TTL_MS,
} from '@/lib/verificationWindow'

type VerificationEmailUser = {
  email: string
  role?: string | null
  _verified?: boolean | null
  _verificationToken?: string | null
  verificationEmailLastSentAt?: Date | string | null
}

type ResetPasswordEmailUser = {
  email?: string | null
}

export function isPublicSignupRole(role: unknown): role is 'founder' | 'investor' {
  return role === 'founder' || role === 'investor'
}

export function hasPendingEmailVerification(user: VerificationEmailUser | null | undefined): boolean {
  if (!user || !isPublicSignupRole(user.role) || user._verified === true) {
    return false
  }

  return typeof user._verificationToken === 'string' && user._verificationToken.trim().length > 0
}

export function shouldAutoVerifyLoginUser(user: VerificationEmailUser | null | undefined): boolean {
  if (!user || user._verified === true) {
    return false
  }

  if (!isPublicSignupRole(user.role)) {
    return true
  }

  return !hasPendingEmailVerification(user)
}

export function createEmailVerificationToken(): string {
  return randomBytes(20).toString('hex')
}

export function getVerificationDeadline(createdAt: Date | string): Date {
  const createdAtDate = createdAt instanceof Date ? createdAt : new Date(createdAt)
  return new Date(createdAtDate.getTime() + EMAIL_VERIFICATION_TTL_MS)
}

export function isVerificationExpired(createdAt: Date | string, now = new Date()): boolean {
  return getVerificationDeadline(createdAt).getTime() <= now.getTime()
}

export function getVerificationResendCooldownDeadline(sentAt: Date | string): Date {
  const sentAtDate = sentAt instanceof Date ? sentAt : new Date(sentAt)
  return new Date(sentAtDate.getTime() + EMAIL_VERIFICATION_RESEND_COOLDOWN_MS)
}

export function getVerificationResendCooldownRemainingSeconds(
  sentAt: Date | string,
  now = new Date(),
): number {
  const remainingMs = getVerificationResendCooldownDeadline(sentAt).getTime() - now.getTime()

  if (remainingMs <= 0) {
    return 0
  }

  return Math.ceil(remainingMs / 1000)
}

export function isVerificationResendCoolingDown(
  sentAt: Date | string,
  now = new Date(),
): boolean {
  return getVerificationResendCooldownRemainingSeconds(sentAt, now) > 0
}

export function buildEmailVerificationUrl(token: string): string {
  const appUrl = getAppUrl()
  const url = new URL('/api/auth/verify-email', appUrl)
  url.searchParams.set('token', token)
  return url.toString()
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getRoleLabel(role: string | null | undefined): string {
  if (role === 'investor') return 'investor'
  return 'founder'
}

function wrapAuthEmailTemplate({
  title,
  eyebrow,
  bodyHtml,
}: {
  title: string
  eyebrow: string
  bodyHtml: string
}): string {
  const safeTitle = escapeHtml(title)
  const safeEyebrow = escapeHtml(eyebrow)

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #080810; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #080810; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #0d0d14; border-radius: 20px; overflow: hidden; box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6); border: 1px solid rgba(228, 185, 77, 0.18);">
          <tr>
            <td align="center" style="padding: 44px 0 40px; background-color: #0a0a0f; border-bottom: 1px solid rgba(228, 185, 77, 0.25);">
              <h1 style="color: #E4B94D; margin: 0 0 6px; font-size: 28px; font-weight: bold; letter-spacing: 5px; text-transform: uppercase;">MESGA</h1>
              <p style="color: rgba(228, 185, 77, 0.4); margin: 0; font-size: 9px; letter-spacing: 3px; text-transform: uppercase;">${safeEyebrow}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 44px 44px; background-color: #0d0d14; text-align: center;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 44px; background-color: #080810; text-align: center; border-top: 1px solid rgba(228, 185, 77, 0.08);">
              <p style="color: #2a2a3a; font-size: 11px; margin: 0; letter-spacing: 0.5px;">
                &copy; ${new Date().getFullYear()} MESGA. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function buildEmailActionButton(label: string, url: string): string {
  const safeLabel = escapeHtml(label)
  const safeUrl = escapeHtml(url)

  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center" style="padding: 24px 0 8px;">
        <a href="${safeUrl}" style="display: inline-block; padding: 15px 40px; background: linear-gradient(90deg, #E4B94D 0%, #c87533 100%); color: #0a0a0f; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 15px; letter-spacing: 0.5px;">
          <span style="color: #0a0a0f; font-weight: bold;">${safeLabel}</span>
        </a>
      </td>
    </tr>
  </table>`
}

export function generateVerificationEmailSubject(): string {
  return 'Confirm your MESGA account'
}

export function generateVerificationEmailHTML({
  token,
  user,
}: {
  token: string
  user: VerificationEmailUser
}): string {
  const verificationUrl = buildEmailVerificationUrl(token)
  const safeEmail = escapeHtml(user.email)
  const roleLabel = escapeHtml(getRoleLabel(user.role))
  const safeVerificationUrl = escapeHtml(verificationUrl)

  return wrapAuthEmailTemplate({
    title: generateVerificationEmailSubject(),
    eyebrow: 'Email Verification',
    bodyHtml: `
      <h2 style="color: #ffffff; font-size: 20px; margin-top: 0;">Confirm your email address</h2>
      <p style="color: #a1a1aa; font-size: 16px; line-height: 24px; margin-bottom: 16px;">
        We created your MESGA ${roleLabel} account for <strong style="color: #ffffff;">${safeEmail}</strong>.
      </p>
      <p style="color: #a1a1aa; font-size: 16px; line-height: 24px; margin-bottom: 0;">
        Confirm your email to activate the account. The confirmation window is open for ${EMAIL_VERIFICATION_TTL_HOURS} hours. If nothing happens before then, the unconfirmed account will be deleted automatically.
      </p>
      ${buildEmailActionButton('Confirm Email', verificationUrl)}
      <p style="color: #7c7c8f; font-size: 13px; line-height: 20px; margin: 24px 0 0;">
        If the button does not work, copy and paste this link into your browser:
      </p>
      <p style="margin: 12px 0 0;">
        <a href="${safeVerificationUrl}" style="color: #E4B94D; text-decoration: none; word-break: break-all; font-size: 13px; line-height: 20px;">${safeVerificationUrl}</a>
      </p>
      <p style="color: #a1a1aa; font-size: 16px; line-height: 24px; margin: 24px 0 0;">
        If you did not create this account, you can safely ignore this email.
      </p>
    `,
  })
}

export function generateResetPasswordEmailHTML({
  token,
  user,
}: {
  token: string
  user: ResetPasswordEmailUser
}): string {
  const resetUrl = new URL('/reset-password', getAppUrl())
  resetUrl.searchParams.set('token', token)

  const resetLink = resetUrl.toString()
  const safeResetLink = escapeHtml(resetLink)
  const safeEmail = escapeHtml(user.email || 'your account')

  return wrapAuthEmailTemplate({
    title: 'Reset Password',
    eyebrow: 'Account Security',
    bodyHtml: `
      <h2 style="color: #ffffff; font-size: 20px; margin-top: 0;">Reset your password</h2>
      <p style="color: #a1a1aa; font-size: 16px; line-height: 24px; margin-bottom: 16px;">
        We received a password reset request for <strong style="color: #ffffff;">${safeEmail}</strong>.
      </p>
      <p style="color: #a1a1aa; font-size: 16px; line-height: 24px; margin-bottom: 0;">
        If that was you, use the button below to choose a new password securely.
      </p>
      ${buildEmailActionButton('Reset Password', resetLink)}
      <p style="color: #7c7c8f; font-size: 13px; line-height: 20px; margin: 24px 0 0;">
        If the button does not work, copy and paste this link into your browser:
      </p>
      <p style="margin: 12px 0 0;">
        <a href="${safeResetLink}" style="color: #E4B94D; text-decoration: none; word-break: break-all; font-size: 13px; line-height: 20px;">${safeResetLink}</a>
      </p>
      <p style="color: #a1a1aa; font-size: 16px; line-height: 24px; margin: 24px 0 0;">
        If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
      </p>
    `,
  })
}

export async function sendVerificationEmail(
  payload: Payload,
  user: VerificationEmailUser,
  token: string,
): Promise<void> {
  await payload.sendEmail({
    to: user.email,
    subject: generateVerificationEmailSubject(),
    html: generateVerificationEmailHTML({ token, user }),
  })
}
