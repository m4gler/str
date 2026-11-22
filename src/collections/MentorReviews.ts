import type { CollectionConfig } from 'payload'
import { gateDecisionAfterChange } from '@/hooks/gateDecisionHook'
import { mentorReviewNotificationAfterChange } from '@/hooks/mentorReviewNotificationHook'

export const MentorReviews: CollectionConfig = {
  slug: 'mentor-reviews',
  trash: true,
  hooks: {
    beforeChange: [
      ({ req, data }) => {
        // Deliberately block authenticated direct REST/admin writes from
        // non-admins. Mentor writes must go through server actions, which
        // enforce partner scoping, duplicate review checks, and gate rules.
        if (req.user && req.user.role !== 'admin') {
          throw new Error('Direct API writes are disabled for mentor reviews.')
        }
        return data
      },
    ],
    afterChange: [gateDecisionAfterChange, mentorReviewNotificationAfterChange],
  },
  admin: {
    useAsTitle: 'id',
    group: '📅 Day Program',
    description: 'Mentor reviews of daily submissions. Includes score, comment, and gate decisions.',
    defaultColumns: ['submission', 'reviewer', 'score', 'dayNumber', 'isGateReview', 'createdAt'],
    components: {
      views: {
        edit: {
          default: {
            Component: '@/components/Payload/MentorReviewEditor#default',
          },
        },
      },
    },
  },
  access: {
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'mentor',
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      if (user.role === 'mentor') {
        const partnerId = (user as any).partner?.id ?? (user as any).partner
        if (!partnerId) return false // no partner = no access (use admin role for full access)
        return { 'submission.partner': { equals: partnerId } } as any
      }
      // Founders can read reviews of their own submissions
      if (user.role === 'founder') return { 'submission.user': { equals: user.id } } as any
      return false
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      // Mentors can update their own reviews
      if (user.role === 'mentor') return { reviewer: { equals: user.id } }
      return false
    },
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'submission',
      type: 'relationship',
      relationTo: 'founder-form-submissions',
      required: true,
      index: true,
      admin: { description: 'The daily submission being reviewed.' },
    },
    {
      name: 'reviewer',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: { description: 'The mentor/admin who performed this review.' },
    },
    {
      name: 'dayNumber',
      type: 'number',
      min: 1,
      max: 100,
      index: true,
      admin: { description: 'Program day number being reviewed.' },
    },
    {
      name: 'score',
      type: 'number',
      min: 1,
      max: 5,
      admin: { description: 'Score from 1 (poor) to 5 (excellent).' },
    },
    {
      name: 'comment',
      type: 'textarea',
      admin: { description: 'Mentor feedback comment visible to the founder.' },
    },
    {
      name: 'internalNote',
      type: 'textarea',
      admin: { description: 'Internal note visible only to admin/mentors.' },
    },
    {
      name: 'isRetro',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Whether this is a retro day review. Auto-set based on day_type.' },
    },
    // ── Gate Review Fields ──
    {
      name: 'isGateReview',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Whether this review is for a gate day (15/30/50/70/94).' },
    },
    {
      name: 'gateDecision',
      type: 'select',
      options: [
        { label: 'Pass', value: 'pass' },
        { label: 'Fail', value: 'fail' },
        { label: 'Revise', value: 'revise' },
      ],
      admin: {
        description: 'Gate decision: pass (continue), fail (attempt over), or revise (resubmit).',
        condition: (data) => data?.isGateReview,
      },
    },
    {
      name: 'gateChecklistCompleted',
      type: 'json',
      admin: {
        description: 'JSON array of completed gate checklist items. E.g. ["pitch_deck", "financial_model", "customer_interviews"]',
        condition: (data) => data?.isGateReview,
      },
    },
    {
      name: 'evidencePackUrl',
      type: 'text',
      admin: {
        description: 'URL to the evidence pack document for gate review.',
        condition: (data) => data?.isGateReview,
      },
    },
  ],
}
