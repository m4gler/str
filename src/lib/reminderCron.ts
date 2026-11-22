import type { Payload } from 'payload'
import {
  notifyGateFail,
  notifyPartnerReminder,
} from '@/lib/notifications'
import { notifyTelegram } from '@/lib/telegram'

export interface ReminderCronResult {
  gateFailures: number
  partnerReminders: number
  partnerEscalations: number
}

export async function runReminderCron(
  payload: Payload,
  appUrl: string,
): Promise<ReminderCronResult> {
  let gateFailures = 0
  let partnerReminders = 0
  let partnerEscalations = 0

  const { docs: revisionAttempts } = await payload.find({
    collection: 'attempts',
    where: {
      status: { in: ['active', 'warned_1', 'warned_2'] },
      gateRevisionDeadline: { less_than: new Date().toISOString() },
      gateRevisionForDay: { greater_than: 0 },
    },
    limit: 100,
    depth: 2,
  })

  for (const revAttempt of revisionAttempts) {
    const revUser = typeof revAttempt.user === 'object' ? revAttempt.user : null
    if (!revUser) continue

    const gateDay = revAttempt.gateRevisionForDay!
    const { totalDocs: resubCount } = await payload.count({
      collection: 'founder-form-submissions',
      where: {
        and: [
          { user: { equals: revUser.id } },
          { programDay: { equals: gateDay } },
          { attempt: { equals: revAttempt.id } },
          { createdAt: { greater_than: revAttempt.gateRevisionDeadline ? new Date(new Date(revAttempt.gateRevisionDeadline).getTime() - 48 * 60 * 60 * 1000).toISOString() : '' } },
        ],
      },
    })

    if (resubCount > 0) {
      await payload.update({
        collection: 'attempts',
        id: revAttempt.id,
        data: { gateRevisionDeadline: null, gateRevisionForDay: null },
      })
      continue
    }

    await payload.update({
      collection: 'attempts',
      id: revAttempt.id,
      data: {
        status: 'failed',
        endedAt: new Date().toISOString(),
        gateFailedAt: new Date().toISOString(),
        gateRevisionDeadline: null,
        gateRevisionForDay: null,
      },
    })

    await payload.update({
      collection: 'users',
      id: revUser.id,
      data: { programStatus: 'failed' },
      overrideAccess: true,
    })

    const { docs: adminsForGate } = await payload.find({
      collection: 'users',
      where: { role: { equals: 'admin' } },
      limit: 10,
    })

    await notifyGateFail(
      payload,
      { email: revUser.email },
      adminsForGate.map((admin: any) => ({ email: admin.email })),
      gateDay,
      (revAttempt as any).attemptNumber,
      appUrl,
    )

    gateFailures++
  }

  const { docs: pendingPartnerAttempts } = await payload.find({
    collection: 'attempts',
    where: {
      partnerDecision: { equals: 'pending' },
      partnerOverrideRequestedAt: { exists: true },
    },
    limit: 100,
    depth: 2,
  })

  const now48h = Date.now() - 48 * 60 * 60 * 1000
  const now96h = Date.now() - 96 * 60 * 60 * 1000

  for (const pendingAttempt of pendingPartnerAttempts) {
    const requestedAt = new Date(pendingAttempt.partnerOverrideRequestedAt!).getTime()
    const pendingUser = typeof pendingAttempt.user === 'object' ? pendingAttempt.user : null
    if (!pendingUser) continue

    const partnerId = (pendingUser as any).partner?.id ?? (pendingUser as any).partner
    if (!partnerId) continue

    const { docs: partnerUsers } = await payload.find({
      collection: 'users',
      where: { and: [{ role: { equals: 'partner' } }, { partner: { equals: partnerId } }] },
      limit: 1,
    })

    const { docs: adminUsers } = await payload.find({
      collection: 'users',
      where: { role: { equals: 'admin' } },
      limit: 5,
    })

    if (requestedAt <= now96h && pendingAttempt.partnerReminderSentAt) {
      const reminderSentTime = new Date(pendingAttempt.partnerReminderSentAt).getTime()
      const escalationAlreadySent = reminderSentTime > (requestedAt + 90 * 60 * 60 * 1000)
      if (!escalationAlreadySent) {
        await notifyTelegram(
          'warning',
          'Partner override overdue (96h+)',
          `Founder: ${pendingUser.email}\nAttempt: ${(pendingAttempt as any).attemptNumber}\nPartner ID: ${partnerId}`,
        )
        if (adminUsers.length > 0 && partnerUsers.length > 0) {
          await notifyPartnerReminder(
            payload,
            { email: (partnerUsers[0] as any).email },
            { email: (adminUsers[0] as any).email },
            pendingUser.email,
            appUrl,
          )
        }
        await payload.update({
          collection: 'attempts',
          id: pendingAttempt.id,
          data: { partnerReminderSentAt: new Date().toISOString() },
        })
        partnerEscalations++
      }
    } else if (requestedAt <= now48h && !pendingAttempt.partnerReminderSentAt) {
      if (partnerUsers.length > 0 && adminUsers.length > 0) {
        await notifyPartnerReminder(
          payload,
          { email: (partnerUsers[0] as any).email },
          { email: (adminUsers[0] as any).email },
          pendingUser.email,
          appUrl,
        )
      }
      await payload.update({
        collection: 'attempts',
        id: pendingAttempt.id,
        data: { partnerReminderSentAt: new Date().toISOString() },
      })
      partnerReminders++
    }
  }

  return {
    gateFailures,
    partnerReminders,
    partnerEscalations,
  }
}

