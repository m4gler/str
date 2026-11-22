/**
 * Email notification system for the 100-Day Program.
 * Uses Payload's built-in Resend email adapter.
 *
 * Per PRD Section 5.7: MVP = email only (no push/SMS).
 */

import type { Payload } from 'payload'
import { notifyTelegram } from '@/lib/telegram'
import { createUnsubscribeUrl } from '@/app/api/unsubscribe/route'

const FROM_ADDRESS = 'notifications@email.bakery.vc'
const FROM_NAME = 'MESGA Platform'
const DEFAULT_NEW_SUBMISSION_ALERT_EMAIL = 'edikmuntyanovphone@gmail.com'
const DEFAULT_FOUNDER_CHAT_INVITE_LINK = 'https://chat.whatsapp.com/G81fgIaVNYVGTNjGE6ijd6'
const DEFAULT_FOUNDER_CHAT_INVITE_SUBJECT = 'Join the MESGA founder chat'
const DEFAULT_FOUNDER_CHAT_INVITE_BODY = [
  'Hi {firstName},',
  '',
  'Your MESGA 100 Days access is active. Join the founder chat here:',
  '{inviteLink}',
  '',
  'See you inside,',
  'MESGA Team',
].join('\n')

// ── Types ──

interface EmailRecipient {
  email: string
  name?: string
}

/** Notification category — maps to both user emailPreferences and platform notifications toggles */
type NotificationCategory = 'attemptNotifications' | 'paymentReminders' | 'gateNotifications' | 'programUpdates' | 'newsletter'

const PLATFORM_TOGGLE_MAP: Record<NotificationCategory, string> = {
  attemptNotifications: 'attemptNotificationsEnabled',
  paymentReminders: 'paymentRemindersEnabled',
  gateNotifications: 'gateNotificationsEnabled',
  programUpdates: 'programUpdatesEnabled',
  newsletter: 'newsletterEnabled',
}

/**
 * Check if a notification should be sent based on:
 * 1. Platform-level global toggle (PlatformSettings.notifications.*)
 * 2. User-level preference (User.emailPreferences.*)
 * Returns true if the email should be sent.
 */
async function shouldSendNotification(
  payload: Payload,
  recipientEmail: string,
  category: NotificationCategory,
): Promise<boolean> {
  try {
    // Check platform-level toggle
    const settings = await payload.findGlobal({ slug: 'platform-settings' }) as any
    const platformKey = PLATFORM_TOGGLE_MAP[category]
    if (settings?.notifications?.[platformKey] === false) {
      return false
    }

    // Check user-level preference
    const users = await payload.find({
      collection: 'users',
      where: { email: { equals: recipientEmail } },
      limit: 1,
    })
    if (users.docs.length > 0) {
      const user = users.docs[0] as any
      if (user?.emailPreferences?.[category] === false) {
        return false
      }
    }
  } catch (err) {
    // If preference check fails, send the email anyway (fail open for notifications)
    console.warn(`[notifications] Could not check preferences for ${recipientEmail}: ${err}`)
  }
  return true
}

// ── Email Template Wrapper ──

function wrapInTemplate(title: string, bodyHtml: string, unsubscribeUrl?: string): string {
  const unsubscribeHtml = unsubscribeUrl
    ? `<p style="color: #2a2a3a; font-size: 11px; margin: 8px 0 0;">
        <a href="${unsubscribeUrl}" style="color: #3a3a4a; text-decoration: underline;">Unsubscribe</a> from these emails
      </p>`
    : ''

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #080810; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #080810; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #0d0d14; border-radius: 20px; overflow: hidden; box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6); border: 1px solid rgba(228, 185, 77, 0.18);">
          <tr>
            <td align="center" style="padding: 44px 0 40px; background-color: #0a0a0f; border-bottom: 1px solid rgba(228, 185, 77, 0.25);">
              <h1 style="color: #E4B94D; margin: 0 0 6px; font-size: 28px; font-weight: bold; letter-spacing: 5px; text-transform: uppercase;">MESGA</h1>
              <p style="color: rgba(228, 185, 77, 0.4); margin: 0; font-size: 9px; letter-spacing: 3px; text-transform: uppercase;">Platform Notification</p>
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
              ${unsubscribeHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function actionButton(label: string, url: string): string {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center" style="padding: 24px 0 8px;">
        <a href="${url}" style="display: inline-block; padding: 15px 40px; background: linear-gradient(90deg, #E4B94D 0%, #c87533 100%); color: #0a0a0f; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 15px; letter-spacing: 0.5px;">
          <span style="color: #0a0a0f; font-weight: bold;">${label}</span>
        </a>
      </td>
    </tr>
  </table>`
}

function formatAlertField(value: boolean | number | string | null | undefined): string {
  if (value == null || value === '') return '—'
  return escapeHtml(String(value))
}

function formatMultilineAlertField(value: string | null | undefined): string {
  if (!value?.trim()) return '—'
  return escapeHtml(value.trim()).replace(/\n/g, '<br />')
}

function resolveNewSubmissionAlertEmail(settings: any): string | null {
  const configuredEmail = settings?.notifications?.newSubmissionAlertEmail
  if (typeof configuredEmail === 'string') {
    const trimmed = configuredEmail.trim()
    if (!trimmed) return null
    return trimmed
  }

  return DEFAULT_NEW_SUBMISSION_ALERT_EMAIL
}

function resolveConfiguredText(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

function renderFounderInviteTemplate(template: string, replacements: {
  firstName: string
  email: string
  inviteLink: string
}): string {
  return template
    .replace(/\{firstName\}/g, replacements.firstName)
    .replace(/\{email\}/g, replacements.email)
    .replace(/\{inviteLink\}/g, replacements.inviteLink)
}

// ── Send Helper ──

async function sendEmail(
  payload: Payload,
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  try {
    await payload.sendEmail({
      to,
      subject,
      html,
    })
  } catch (err: any) {
    console.error(`[notifications] Failed to send email to ${to}: ${err}`)
    await notifyTelegram('error', 'Email send failed', `To: ${to}\nSubject: ${subject}\n${err?.message || String(err)}`)
  }
}

async function sendToMultiple(
  payload: Payload,
  recipients: EmailRecipient[],
  subject: string,
  html: string,
): Promise<void> {
  await Promise.allSettled(
    recipients.map((r) => sendEmail(payload, r.email, subject, html)),
  )
}

// ── Notification Functions (PRD Section 5.7) ──

/**
 * Day N submitted — Day N+1 unlocked
 */
export async function notifySubmissionAccepted(
  payload: Payload,
  founder: EmailRecipient,
  dayNumber: number,
  appUrl: string,
): Promise<void> {
  if (!(await shouldSendNotification(payload, founder.email, 'programUpdates'))) return
  const unsubUrl = createUnsubscribeUrl(appUrl, founder.email, 'programUpdates')
  const subject = `Day ${dayNumber} submitted ✔ — Day ${dayNumber + 1} unlocked`
  const html = wrapInTemplate(subject, `
    <h2 style="color: #ffffff; font-size: 20px; margin-top: 0;">Day ${dayNumber} Complete!</h2>
    <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
      Your submission for Day ${dayNumber} has been accepted. Day ${dayNumber + 1} is now unlocked.
    </p>
    <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
      Keep up the momentum — every day counts.
    </p>
    ${actionButton('Go to Day ' + (dayNumber + 1), appUrl)}
  `, unsubUrl)
  await sendEmail(payload, founder.email, subject, html)
}

export async function notifyFounderChatInvite(
  payload: Payload,
  user: {
    id?: string | number
    email?: string | null
    firstName?: string | null
    role?: string | null
  },
): Promise<void> {
  if (user.role !== 'founder') return
  if (!user.email) return

  const settings = await payload.findGlobal({ slug: 'platform-settings' }).catch(() => null) as any
  const notificationSettings = settings?.notifications || {}
  if (notificationSettings.founderChatInviteEnabled === false) return

  const inviteLink = resolveConfiguredText(
    notificationSettings.founderChatInviteLink,
    DEFAULT_FOUNDER_CHAT_INVITE_LINK,
  )
  const subjectTemplate = resolveConfiguredText(
    notificationSettings.founderChatInviteSubject,
    DEFAULT_FOUNDER_CHAT_INVITE_SUBJECT,
  )
  const bodyTemplate = resolveConfiguredText(
    notificationSettings.founderChatInviteBody,
    DEFAULT_FOUNDER_CHAT_INVITE_BODY,
  )

  const replacements = {
    firstName: resolveConfiguredText(user.firstName, 'Founder'),
    email: user.email,
    inviteLink,
  }
  const subject = renderFounderInviteTemplate(subjectTemplate, replacements)
  const renderedBody = renderFounderInviteTemplate(bodyTemplate, replacements)
  const bodyHtml = escapeHtml(renderedBody).replace(/\n/g, '<br />')
  const safeInviteLink = escapeHtml(inviteLink)

  const html = wrapInTemplate(subject, `
    <h2 style="color: #ffffff; font-size: 20px; margin-top: 0;">Founder chat invite</h2>
    <p style="color: #a1a1aa; font-size: 16px; line-height: 24px; text-align: left;">
      ${bodyHtml}
    </p>
    ${actionButton('Join founder chat', safeInviteLink)}
  `)

  await sendEmail(payload, user.email, subject, html)
}

/**
 * Miss 1/3 — Founder + Mentor
 */
export async function notifyMiss1(
  payload: Payload,
  founder: EmailRecipient,
  additionalRecipients: EmailRecipient[],
  dayNumber: number,
  appUrl: string,
): Promise<void> {
  if (!(await shouldSendNotification(payload, founder.email, 'attemptNotifications'))) return
  const unsubUrl = createUnsubscribeUrl(appUrl, founder.email, 'attemptNotifications')
  const subject = `Miss 1/3 — you have 2 more chances this attempt`
  const html = wrapInTemplate(subject, `
    <h2 style="color: #E4B94D; font-size: 20px; margin-top: 0;">⚠ Miss 1 of 3</h2>
    <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
      You missed the deadline for Day ${dayNumber}. This is your first miss — you have 2 more chances before this attempt ends.
    </p>
    <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
      You can still submit Day ${dayNumber} as a backfill until the end of tomorrow (23:59). However, you must also submit the current day's task by the same deadline.
    </p>
    ${actionButton('Submit Day ' + dayNumber + ' Now', appUrl)}
  `, unsubUrl)
  await sendToMultiple(payload, [founder, ...additionalRecipients], subject, html)
}

/**
 * LAST WARNING: Miss 2/3 — Founder + Mentor + Admin
 */
export async function notifyMiss2(
  payload: Payload,
  founder: EmailRecipient,
  additionalRecipients: EmailRecipient[],
  dayNumber: number,
  appUrl: string,
): Promise<void> {
  if (!(await shouldSendNotification(payload, founder.email, 'attemptNotifications'))) return
  const unsubUrl = createUnsubscribeUrl(appUrl, founder.email, 'attemptNotifications')
  const subject = `LAST WARNING: Miss 2/3 — one more miss ends this attempt`
  const html = wrapInTemplate(subject, `
    <h2 style="color: #C96A4A; font-size: 20px; margin-top: 0;">🚨 LAST WARNING — Miss 2 of 3</h2>
    <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
      You missed the deadline for Day ${dayNumber}. This is your <strong>second miss</strong> — one more missed deadline will automatically end this attempt.
    </p>
    <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
      You can still submit Day ${dayNumber} as a backfill until the end of tomorrow. Please don't miss another day.
    </p>
    ${actionButton('Submit Now', appUrl)}
  `, unsubUrl)
  await sendToMultiple(payload, [founder, ...additionalRecipients], subject, html)
}

/**
 * Attempt N failed — 3rd miss
 */
export async function notifyAttemptFailed(
  payload: Payload,
  founder: EmailRecipient,
  additionalRecipients: EmailRecipient[],
  attemptNumber: number,
  maxAttempts: number,
  paymentType: string,
  appUrl: string,
): Promise<void> {
  if (!(await shouldSendNotification(payload, founder.email, 'attemptNotifications'))) return
  const unsubUrl = createUnsubscribeUrl(appUrl, founder.email, 'attemptNotifications')
  const hasMoreAttempts = ['paid', 'self_paid'].includes(paymentType) && attemptNumber < maxAttempts
  const isSponsored = ['sponsored', 'partnership'].includes(paymentType)

  let nextStepHtml = ''
  if (hasMoreAttempts) {
    nextStepHtml = `
      <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
        You still have ${maxAttempts - attemptNumber} attempt(s) remaining. Start your next attempt from the dashboard when you're ready.
      </p>
      ${actionButton('Start Attempt ' + (attemptNumber + 1), appUrl + '/start-program')}
    `
  } else if (isSponsored) {
    nextStepHtml = `
      <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
        Your Partner/Sponsor has been notified and will decide on granting an additional attempt within 48 hours.
      </p>
    `
  } else {
    nextStepHtml = `
      <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
        All available attempts have been used. Contact your program admin for more information.
      </p>
    `
  }

  const subject = `Attempt ${attemptNumber} ended — 3 missed deadlines`
  const html = wrapInTemplate(subject, `
    <h2 style="color: #C96A4A; font-size: 20px; margin-top: 0;">Attempt ${attemptNumber} of ${maxAttempts} has ended</h2>
    <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
      Your attempt #${attemptNumber} has automatically ended due to 3 missed daily deadlines.
    </p>
    ${nextStepHtml}
  `, unsubUrl)
  await sendToMultiple(payload, [founder, ...additionalRecipients], subject, html)
}

/**
 * Congratulations — Day 100 completed!
 */
export async function notifyProgramCompleted(
  payload: Payload,
  founder: EmailRecipient,
  additionalRecipients: EmailRecipient[],
  attemptNumber: number,
  appUrl: string,
): Promise<void> {
  if (!(await shouldSendNotification(payload, founder.email, 'programUpdates'))) return
  const unsubUrl = createUnsubscribeUrl(appUrl, founder.email, 'programUpdates')
  const subject = `Congratulations! You completed the 100-Day Program!`
  const html = wrapInTemplate(subject, `
    <h2 style="color: #2CB1A1; font-size: 24px; margin-top: 0;">🎉 Congratulations!</h2>
    <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
      You successfully completed the entire 100-Day Program on attempt #${attemptNumber}. This is an incredible achievement.
    </p>
    <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
      Your journey through 100 days of consistent execution sets you apart. Well done.
    </p>
    ${actionButton('View Your Dashboard', appUrl)}
  `, unsubUrl)
  await sendToMultiple(payload, [founder, ...additionalRecipients], subject, html)
}

/**
 * Partner override required — sent to Partner/Sponsor
 */
export async function notifyPartnerOverrideRequired(
  payload: Payload,
  partner: EmailRecipient,
  founderName: string,
  attemptNumber: number,
  dayReached: number,
  appUrl: string,
): Promise<void> {
  // Partner notifications check platform toggle only (not user prefs — partners must receive these)
  try {
    const settings = await payload.findGlobal({ slug: 'platform-settings' }) as any
    if (settings?.notifications?.partnerNotificationsEnabled === false) return
  } catch { /* send anyway */ }

  const subject = `[Action Required] ${founderName} requires your decision`
  const html = wrapInTemplate(subject, `
    <h2 style="color: #E4B94D; font-size: 20px; margin-top: 0;">Decision Required</h2>
    <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
      <strong>${founderName}</strong> has used all allocated attempts (attempt #${attemptNumber} failed at Day ${dayReached}).
    </p>
    <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
      As their Partner/Sponsor, you can:
    </p>
    <ul style="color: #a1a1aa; font-size: 16px; line-height: 28px;">
      <li><strong>Grant an extra attempt</strong> — the founder starts fresh with 0 misses</li>
      <li><strong>End the process</strong> — the founder's dashboard is frozen</li>
    </ul>
    <p style="color: #71717a; font-size: 14px; line-height: 20px;">
      You have 48 hours to respond. After that, you'll receive a reminder and the admin will be notified.
    </p>
    ${actionButton('Make Decision', appUrl + '/partner')}
  `)
  await sendEmail(payload, partner.email, subject, html)
}

/**
 * Partner reminder — 48h without decision
 */
export async function notifyPartnerReminder(
  payload: Payload,
  partner: EmailRecipient,
  admin: EmailRecipient,
  founderName: string,
  appUrl: string,
): Promise<void> {
  try {
    const settings = await payload.findGlobal({ slug: 'platform-settings' }) as any
    if (settings?.notifications?.partnerNotificationsEnabled === false) return
  } catch { /* send anyway */ }

  const subject = `Reminder: decision required for ${founderName}`
  const html = wrapInTemplate(subject, `
    <h2 style="color: #E4B94D; font-size: 20px; margin-top: 0;">Reminder — Decision Overdue</h2>
    <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
      A decision for <strong>${founderName}</strong> has been pending for over 48 hours. The program admin has been CC'd on this reminder.
    </p>
    ${actionButton('Make Decision Now', appUrl + '/partner')}
  `)
  await sendToMultiple(payload, [partner, admin], subject, html)
}

/**
 * Gate decision: PASS — sent to Founder
 */
export async function notifyGatePass(
  payload: Payload,
  founder: EmailRecipient,
  dayNumber: number,
  appUrl: string,
): Promise<void> {
  if (!(await shouldSendNotification(payload, founder.email, 'gateNotifications'))) return
  const unsubUrl = createUnsubscribeUrl(appUrl, founder.email, 'gateNotifications')
  const subject = `Gate Day ${dayNumber} — PASSED`
  const html = wrapInTemplate(subject, `
    <h2 style="color: #2CB1A1; font-size: 20px; margin-top: 0;">Gate ${dayNumber} Passed!</h2>
    <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
      Congratulations — your Gate Day ${dayNumber} submission has been approved. You can continue with the program.
    </p>
    ${actionButton('Continue Program', appUrl)}
  `, unsubUrl)
  await sendEmail(payload, founder.email, subject, html)
}

/**
 * Gate decision: FAIL — sent to Founder + Admins
 */
export async function notifyGateFail(
  payload: Payload,
  founder: EmailRecipient,
  additionalRecipients: EmailRecipient[],
  dayNumber: number,
  attemptNumber: number,
  appUrl: string,
): Promise<void> {
  if (!(await shouldSendNotification(payload, founder.email, 'gateNotifications'))) return
  const unsubUrl = createUnsubscribeUrl(appUrl, founder.email, 'gateNotifications')
  const subject = `Gate Day ${dayNumber} — FAILED — Attempt ${attemptNumber} ended`
  const html = wrapInTemplate(subject, `
    <h2 style="color: #C96A4A; font-size: 20px; margin-top: 0;">Gate ${dayNumber} Failed</h2>
    <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
      Your Gate Day ${dayNumber} submission did not pass the review. Attempt #${attemptNumber} has ended.
    </p>
    <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
      Check your dashboard for information about next steps.
    </p>
    ${actionButton('View Dashboard', appUrl)}
  `, unsubUrl)
  await sendToMultiple(payload, [founder, ...additionalRecipients], subject, html)
}

/**
 * Gate decision: REVISE — sent to Founder
 */
export async function notifyGateRevise(
  payload: Payload,
  founder: EmailRecipient,
  dayNumber: number,
  deadline: Date,
  appUrl: string,
): Promise<void> {
  if (!(await shouldSendNotification(payload, founder.email, 'gateNotifications'))) return
  const unsubUrl = createUnsubscribeUrl(appUrl, founder.email, 'gateNotifications')
  const deadlineStr = deadline.toLocaleString('en-GB', { timeZone: 'Europe/Warsaw', dateStyle: 'medium', timeStyle: 'short' })
  const subject = `Gate Day ${dayNumber} — REVISE by ${deadlineStr}`
  const html = wrapInTemplate(subject, `
    <h2 style="color: #E4B94D; font-size: 20px; margin-top: 0;">Gate ${dayNumber} — Revision Required</h2>
    <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
      Your Gate Day ${dayNumber} submission needs revision. Please resubmit by:
    </p>
    <div style="text-align: center; padding: 16px 0;">
      <span style="font-size: 20px; color: #E4B94D; font-weight: bold;">${deadlineStr} CET</span>
    </div>
    <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
      If you do not resubmit by this deadline, your attempt will be automatically failed.
    </p>
    ${actionButton('Resubmit Now', appUrl)}
  `, unsubUrl)
  await sendEmail(payload, founder.email, subject, html)
}

/**
 * Partner granted extra attempt — sent to Founder
 */
export async function notifyPartnerGranted(
  payload: Payload,
  founder: EmailRecipient,
  newAttemptNumber: number,
  appUrl: string,
): Promise<void> {
  if (!(await shouldSendNotification(payload, founder.email, 'attemptNotifications'))) return
  const unsubUrl = createUnsubscribeUrl(appUrl, founder.email, 'attemptNotifications')
  const subject = `Extra attempt granted — Attempt #${newAttemptNumber} starts now`
  const html = wrapInTemplate(subject, `
    <h2 style="color: #2CB1A1; font-size: 20px; margin-top: 0;">Extra Attempt Granted!</h2>
    <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
      Your Partner/Sponsor has granted you an extra attempt. Attempt #${newAttemptNumber} is now active with a fresh start (0 misses).
    </p>
    ${actionButton('Start Attempt ' + newAttemptNumber, appUrl + '/start-program')}
  `, unsubUrl)
  await sendEmail(payload, founder.email, subject, html)
}

/**
 * Partner ended process — sent to Founder
 */
export async function notifyPartnerEnded(
  payload: Payload,
  founder: EmailRecipient,
  appUrl: string,
): Promise<void> {
  if (!(await shouldSendNotification(payload, founder.email, 'attemptNotifications'))) return
  const unsubUrl = createUnsubscribeUrl(appUrl, founder.email, 'attemptNotifications')
  const subject = `Program process ended by your Partner/Sponsor`
  const html = wrapInTemplate(subject, `
    <h2 style="color: #C96A4A; font-size: 20px; margin-top: 0;">Process Ended</h2>
    <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
      Your Partner/Sponsor has decided to end the program process. Your dashboard has been frozen.
    </p>
    <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
      If you have questions, please contact your Partner directly.
    </p>
    ${actionButton('View Dashboard', appUrl)}
  `, unsubUrl)
  await sendEmail(payload, founder.email, subject, html)
}

/**
 * Partner override grants depleted — sent to all Admins
 */
export async function notifyPartnerGrantsDepleted(
  payload: Payload,
  partnerName: string,
  partnerId: number | string,
  appUrl: string,
): Promise<void> {
  const admins = await payload.find({
    collection: 'users',
    where: { role: { equals: 'admin' } },
    limit: 50,
    depth: 0,
  })
  const subject = `Partner "${partnerName}" has no override grants remaining`
  const html = wrapInTemplate(subject, `
    <h2 style="color: #E4B94D; font-size: 20px; margin-top: 0;">Override Grants Depleted</h2>
    <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
      Partner <strong>${partnerName}</strong> has used all remaining override grants. Any future attempt failures for founders under this partner will require admin intervention.
    </p>
    ${actionButton('Manage Partner', appUrl + '/admin/collections/partners/' + partnerId)}
  `)
  await sendToMultiple(
    payload,
    admins.docs.map((a: any) => ({ email: a.email, name: a.name })),
    subject,
    html,
  )
}

/**
 * Project review decision — sent to Founder
 */
export async function notifyProjectSubmissionDecision(
  payload: Payload,
  founder: EmailRecipient,
  status: 'approved' | 'denied',
  appUrl: string,
  options?: {
    comment?: string | null
    trackName?: string | null
  },
): Promise<void> {
  if (!(await shouldSendNotification(payload, founder.email, 'gateNotifications'))) return

  const unsubUrl = createUnsubscribeUrl(appUrl, founder.email, 'gateNotifications')
  const isApproved = status === 'approved'
  const subject = isApproved
    ? 'Your project has been approved'
    : 'Your project was not approved'
  const title = isApproved ? 'Project Approved' : 'Project Not Approved'
  const accent = isApproved ? '#2CB1A1' : '#C96A4A'
  const safeComment = options?.comment ? escapeHtml(options.comment) : null
  const safeTrackName = options?.trackName ? escapeHtml(options.trackName) : null
  const trackHtml = options?.trackName
    ? `<p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
        Selected track: <strong>${safeTrackName}</strong>
      </p>`
    : ''
  const commentHtml = safeComment
    ? `<div style="margin-top: 24px; padding: 16px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);">
        <p style="color: #71717a; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; margin: 0 0 8px;">Coordinator comment</p>
        <p style="color: #d4d4d8; font-size: 15px; line-height: 24px; margin: 0;">${safeComment}</p>
      </div>`
    : ''

  const html = wrapInTemplate(subject, `
    <h2 style="color: ${accent}; font-size: 20px; margin-top: 0;">${title}</h2>
    <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
      ${isApproved
        ? 'Your project submission has been approved. You can continue with the next steps in the platform.'
        : 'Your project submission was reviewed and is currently not approved. Please check the coordinator note for context.'}
    </p>
    ${trackHtml}
    ${commentHtml}
    ${actionButton(isApproved ? 'Open Dashboard' : 'Review Submission', appUrl)}
  `, unsubUrl)

  await sendEmail(payload, founder.email, subject, html)
}

type ProjectSubmissionAlert = {
  projectDescription?: string | null
  submissionId: number | string
  submitterEmail?: string | null
  trackName?: string | null
}

type UserRegistrationAlert = {
  authMethod?: string | null
  email?: string | null
  isVerified?: boolean | null
  role?: string | null
  userId: number | string
}

type FounderStatusChangedAlert = {
  email?: string | null
  eventLabel: string
  nextStatus?: string | null
  previousStatus?: string | null
  source?: string | null
  userId: number | string
}

export async function notifyProjectSubmissionCreatedAlert(
  payload: Payload,
  submission: ProjectSubmissionAlert,
  appUrl: string,
): Promise<void> {
  let recipientEmail: string | null = DEFAULT_NEW_SUBMISSION_ALERT_EMAIL

  try {
    const settings = await payload.findGlobal({ slug: 'platform-settings' }).catch(() => null) as any
    recipientEmail = resolveNewSubmissionAlertEmail(settings)
  } catch (err) {
    console.warn('[notifications] Could not resolve project submission alert recipient:', err)
  }

  if (!recipientEmail) return

  const subject = `New project submission from ${submission.submitterEmail || 'founder'}`
  const adminUrl = `${appUrl}/admin/collections/project-submissions/${submission.submissionId}`

  const html = wrapInTemplate(subject, `
    <h2 style="color: #ffffff; font-size: 20px; margin-top: 0;">New Project Submission</h2>
    <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
      A founder submitted a project description and it is ready for review in Payload.
    </p>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px 0; color: #71717a; font-size: 13px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">Founder Email</td>
        <td style="padding: 10px 0; color: #ffffff; font-size: 14px; text-align: right; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">${formatAlertField(submission.submitterEmail)}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; color: #71717a; font-size: 13px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">Track</td>
        <td style="padding: 10px 0; color: #ffffff; font-size: 14px; text-align: right; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">${formatAlertField(submission.trackName)}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; color: #71717a; font-size: 13px; vertical-align: top;">Description</td>
        <td style="padding: 10px 0; color: #ffffff; font-size: 14px; text-align: right;">${formatMultilineAlertField(submission.projectDescription)}</td>
      </tr>
    </table>
    ${actionButton('Open in Payload', adminUrl)}
  `)

  await sendEmail(payload, recipientEmail, subject, html)
}

export async function notifyFounderStatusChangedAlert(
  payload: Payload,
  statusChange: FounderStatusChangedAlert,
  appUrl: string,
): Promise<void> {
  let recipientEmail: string | null = DEFAULT_NEW_SUBMISSION_ALERT_EMAIL

  try {
    const settings = await payload.findGlobal({ slug: 'platform-settings' }).catch(() => null) as any
    recipientEmail = resolveNewSubmissionAlertEmail(settings)
  } catch (err) {
    console.warn('[notifications] Could not resolve founder status alert recipient:', err)
  }

  if (!recipientEmail) return

  const subject = `Founder status changed: ${statusChange.email || 'unknown'} → ${statusChange.eventLabel}`
  const adminUrl = `${appUrl}/admin/collections/users/${statusChange.userId}`

  const html = wrapInTemplate(subject, `
    <h2 style="color: #ffffff; font-size: 20px; margin-top: 0;">Founder Status Changed</h2>
    <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
      A founder moved to a new tracked platform stage.
    </p>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px 0; color: #71717a; font-size: 13px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">Founder Email</td>
        <td style="padding: 10px 0; color: #ffffff; font-size: 14px; text-align: right; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">${formatAlertField(statusChange.email)}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; color: #71717a; font-size: 13px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">New Stage</td>
        <td style="padding: 10px 0; color: #ffffff; font-size: 14px; text-align: right; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">${formatAlertField(statusChange.eventLabel)}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; color: #71717a; font-size: 13px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">Previous Status</td>
        <td style="padding: 10px 0; color: #ffffff; font-size: 14px; text-align: right; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">${formatAlertField(statusChange.previousStatus)}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; color: #71717a; font-size: 13px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">Next Status</td>
        <td style="padding: 10px 0; color: #ffffff; font-size: 14px; text-align: right; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">${formatAlertField(statusChange.nextStatus)}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; color: #71717a; font-size: 13px;">Source</td>
        <td style="padding: 10px 0; color: #ffffff; font-size: 14px; text-align: right;">${formatAlertField(statusChange.source)}</td>
      </tr>
    </table>
    ${actionButton('Open User in Payload', adminUrl)}
  `)

  await sendEmail(payload, recipientEmail, subject, html)
}

export async function notifyUserRegistrationAlert(
  payload: Payload,
  registration: UserRegistrationAlert,
  appUrl: string,
): Promise<void> {
  let recipientEmail: string | null = DEFAULT_NEW_SUBMISSION_ALERT_EMAIL

  try {
    const settings = await payload.findGlobal({ slug: 'platform-settings' }).catch(() => null) as any
    recipientEmail = resolveNewSubmissionAlertEmail(settings)
  } catch (err) {
    console.warn('[notifications] Could not resolve registration alert recipient:', err)
  }

  if (!recipientEmail) return

  const subject = `New ${registration.role || 'user'} registration: ${registration.email || 'unknown'}`
  const adminUrl = `${appUrl}/admin/collections/users/${registration.userId}`

  const html = wrapInTemplate(subject, `
    <h2 style="color: #ffffff; font-size: 20px; margin-top: 0;">New Account Registration</h2>
    <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
      A new public account was created and is ready for review in Payload.
    </p>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px 0; color: #71717a; font-size: 13px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">Email</td>
        <td style="padding: 10px 0; color: #ffffff; font-size: 14px; text-align: right; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">${formatAlertField(registration.email)}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; color: #71717a; font-size: 13px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">Role</td>
        <td style="padding: 10px 0; color: #ffffff; font-size: 14px; text-align: right; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">${formatAlertField(registration.role)}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; color: #71717a; font-size: 13px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">Signup Method</td>
        <td style="padding: 10px 0; color: #ffffff; font-size: 14px; text-align: right; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">${formatAlertField(registration.authMethod)}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; color: #71717a; font-size: 13px;">Email Verified</td>
        <td style="padding: 10px 0; color: #ffffff; font-size: 14px; text-align: right;">${formatAlertField(registration.isVerified ? 'Yes' : 'No')}</td>
      </tr>
    </table>
    ${actionButton('Open User in Payload', adminUrl)}
  `)

  await sendEmail(payload, recipientEmail, subject, html)
}

/**
 * Mentor review complete — sent to Founder
 */
export async function notifyMentorReviewComplete(
  payload: Payload,
  founder: EmailRecipient,
  mentorName: string,
  dayNumber: number,
  score: number,
  appUrl: string,
): Promise<void> {
  if (!(await shouldSendNotification(payload, founder.email, 'gateNotifications'))) return
  const unsubUrl = createUnsubscribeUrl(appUrl, founder.email, 'gateNotifications')
  const subject = `Day ${dayNumber} reviewed by ${mentorName} — Score: ${score}/5`
  const html = wrapInTemplate(subject, `
    <h2 style="color: #ffffff; font-size: 20px; margin-top: 0;">Day ${dayNumber} Reviewed</h2>
    <p style="color: #a1a1aa; font-size: 16px; line-height: 24px;">
      Your Day ${dayNumber} submission has been reviewed by <strong>${mentorName}</strong>.
    </p>
    <div style="text-align: center; padding: 20px 0;">
      <span style="font-size: 48px; color: #E4B94D;">${score}</span>
      <span style="font-size: 20px; color: #71717a;">/5</span>
    </div>
    ${actionButton('View Feedback', appUrl)}
  `, unsubUrl)
  await sendEmail(payload, founder.email, subject, html)
}
