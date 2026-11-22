import type { CollectionAfterChangeHook } from 'payload'

import { getAppUrl } from '@/lib/appUrl'
import { notifyMentorReviewComplete } from '@/lib/notifications'

export const mentorReviewNotificationAfterChange: CollectionAfterChangeHook = async ({
  doc,
  req,
  operation,
}) => {
  if (operation !== 'create' || doc.isGateReview) return doc

  const payload = req.payload

  try {
    const submissionId = typeof doc.submission === 'object' ? doc.submission?.id : doc.submission
    if (!submissionId) return doc

    const submission = await payload.findByID({
      collection: 'founder-form-submissions',
      id: submissionId,
      depth: 2,
    }).catch(() => null) as any

    const founderId = typeof submission?.user === 'object' ? submission.user?.id : submission?.user
    const founderFromSubmission = typeof submission?.user === 'object' ? submission.user : null
    const founder = founderFromSubmission ?? (
      founderId
        ? await payload.findByID({
            collection: 'users',
            id: founderId,
            depth: 0,
          }).catch(() => null)
        : null
    ) as any
    if (!founder?.email) return doc

    const reviewerId = typeof doc.reviewer === 'object' ? doc.reviewer?.id : doc.reviewer
    const reviewerFromDoc = typeof doc.reviewer === 'object' ? doc.reviewer : null
    const reviewer = reviewerFromDoc ?? (
      reviewerId
        ? await payload.findByID({
            collection: 'users',
            id: reviewerId,
            depth: 0,
          }).catch(() => null)
        : null
    ) as any

    const reviewerName = reviewer?.name || reviewer?.email || 'Mentor'
    const dayNumber = Number(doc.dayNumber || submission?.programDay || 0)
    const score = Number(doc.score || 0)

    await notifyMentorReviewComplete(
      payload,
      { email: founder.email, name: founder.email },
      reviewerName,
      dayNumber,
      score,
      getAppUrl(),
    )
  } catch (err) {
    console.error('[mentorReviewNotificationHook] Error:', err)
  }

  return doc
}
