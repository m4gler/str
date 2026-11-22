/**
 * afterChange hook for MentorReviews collection.
 * Enforces gate decisions: pass, fail, revise.
 *
 * - fail: transition attempt to failed, update user programStatus
 * - revise: set 48h revision deadline on the attempt
 * - pass: clear any pending revision fields
 */

import type { CollectionAfterChangeHook } from 'payload'
import {
  notifyGatePass,
  notifyGateFail,
  notifyGateRevise,
} from '@/lib/notifications'
import { getAllocationAfterFailure, parseProgramConfig } from '@/lib/attemptEngine'
import { getEffectiveMaxAttemptsForUser } from '@/lib/attemptLimits'
import { notifyPartnerOverrideRequired } from '@/lib/notifications'
import { getAppUrl } from '@/lib/appUrl'

export const gateDecisionAfterChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  operation,
}) => {
  // Only act on gate reviews with a decision change
  if (!doc.isGateReview || !doc.gateDecision) return doc
  if (operation === 'update' && previousDoc?.gateDecision === doc.gateDecision) return doc

  const payload = req.payload
  const appUrl = getAppUrl()

  try {
    // Load submission with depth to get user
    const submission = await payload.findByID({
      collection: 'founder-form-submissions',
      id: typeof doc.submission === 'object' ? doc.submission.id : doc.submission,
      depth: 2,
    }) as any

    if (!submission) return doc

    const user = typeof submission.user === 'object' ? submission.user : null
    if (!user) return doc

    const dayNumber = doc.dayNumber || submission.programDay || 0

    // Find user's active attempt
    const { docs: activeAttempts } = await payload.find({
      collection: 'attempts',
      where: {
        user: { equals: user.id },
        status: { in: ['active', 'warned_1', 'warned_2'] },
      },
      limit: 1,
    })
    const attempt = activeAttempts[0] as any

    const founderRecipient = { email: user.email, name: user.email }

    if (doc.gateDecision === 'fail') {
      // Fail the attempt
      if (attempt) {
        await payload.update({
          collection: 'attempts',
          id: attempt.id,
          data: {
            status: 'failed',
            endedAt: new Date().toISOString(),
            gateFailedAt: new Date().toISOString(),
          },
        })
      }

      // Update user status
      await payload.update({
        collection: 'users',
        id: user.id,
        data: { programStatus: 'failed' },
      })

      // Get admin recipients
      const { docs: admins } = await payload.find({
        collection: 'users',
        where: { role: { equals: 'admin' } },
        limit: 10,
      })
      const adminRecipients = admins.map((a) => ({ email: a.email }))

      await notifyGateFail(payload, founderRecipient, adminRecipients, dayNumber, attempt?.attemptNumber || 1, appUrl)

      // Handle post-failure allocation for sponsored/partner
      if (attempt && ['sponsored', 'partnership'].includes(attempt.paymentType)) {
        const dayProgramGlobal = await payload.findGlobal({ slug: 'day-program' }).catch(() => null)
        const cfg = parseProgramConfig(dayProgramGlobal)
        const maxAttempts = await getEffectiveMaxAttemptsForUser(payload, user, attempt.paymentType, cfg)
        const allocation = getAllocationAfterFailure(attempt.paymentType, attempt.attemptNumber, maxAttempts)

        if (allocation.reason === 'partner_decision_required') {
          const partnerId = user.partner?.id ?? user.partner
          if (partnerId) {
            const { docs: partnerUsers } = await payload.find({
              collection: 'users',
              where: { and: [{ role: { equals: 'partner' } }, { partner: { equals: partnerId } }] },
              limit: 1,
            })
            if (partnerUsers.length > 0) {
              await notifyPartnerOverrideRequired(
                payload,
                { email: partnerUsers[0].email },
                user.email,
                attempt.attemptNumber,
                dayNumber,
                appUrl,
              )
            }
          }
          await payload.update({
            collection: 'attempts',
            id: attempt.id,
            data: {
              partnerOverrideRequestedAt: new Date().toISOString(),
              partnerDecision: 'pending',
            },
          })
        }
      }
    } else if (doc.gateDecision === 'revise') {
      if (attempt) {
        const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48h from now
        await payload.update({
          collection: 'attempts',
          id: attempt.id,
          data: {
            gateRevisionDeadline: deadline.toISOString(),
            gateRevisionForDay: dayNumber,
          },
        })
        await notifyGateRevise(payload, founderRecipient, dayNumber, deadline, appUrl)
      }
    } else if (doc.gateDecision === 'pass') {
      // Clear any revision fields
      if (attempt && (attempt.gateRevisionDeadline || attempt.gateRevisionForDay)) {
        await payload.update({
          collection: 'attempts',
          id: attempt.id,
          data: {
            gateRevisionDeadline: null,
            gateRevisionForDay: null,
          },
        })
      }
      await notifyGatePass(payload, founderRecipient, dayNumber, appUrl)
    }
  } catch (err) {
    console.error('[gateDecisionHook] Error:', err)
  }

  return doc
}
