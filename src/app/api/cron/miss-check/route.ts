/**
 * Cron endpoint: GET /api/cron/miss-check
 *
 * Legacy route name preserved for compatibility.
 *
 * Miss progression is page-load-driven now via ensureFreshAttemptState() /
 * checkAndProcessMisses(). This cron only handles time-based deadlines and
 * reminder/escalation work that should still happen even if the founder never
 * returns.
 *
 * Security: Protected by CRON_SECRET header.
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { notifyTelegram } from '@/lib/telegram'
import { getAppUrl } from '@/lib/appUrl'
import { runReminderCron } from '@/lib/reminderCron'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  // Auth: check CRON_SECRET
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  const authHeader = request.headers.get('authorization') || ''
  const expected = `Bearer ${cronSecret}`
  if (
    authHeader.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await getPayload({ config })
  const appUrl = getAppUrl()

  try {
    const result = await runReminderCron(payload, appUrl)

    if (result.gateFailures > 0 || result.partnerEscalations > 0) {
      await notifyTelegram(
        'warning',
        'Cron reminders: failures or escalations processed',
        `Gate failures: ${result.gateFailures}\nPartner reminders: ${result.partnerReminders}\nPartner escalations: ${result.partnerEscalations}`,
      )
    } else if (result.partnerReminders > 0) {
      await notifyTelegram(
        'info',
        'Cron reminders: partner reminders sent',
        `Gate failures: ${result.gateFailures}\nPartner reminders: ${result.partnerReminders}\nPartner escalations: ${result.partnerEscalations}`,
      )
    }

    return NextResponse.json({
      ok: true,
      mode: 'reminders-only',
      gateFailures: result.gateFailures,
      partnerReminders: result.partnerReminders,
      partnerEscalations: result.partnerEscalations,
    })
  } catch (err: any) {
    console.error('[cron/miss-check] Error:', err)
    await notifyTelegram('error', 'Cron miss-check CRASHED', err?.stack || err?.message || String(err))
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
