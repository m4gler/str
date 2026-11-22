import type { CollectionConfig } from 'payload'

export const Attempts: CollectionConfig = {
  slug: 'attempts',
  trash: true,
  admin: {
    useAsTitle: 'id',
    group: '📅 Day Program',
    description: 'Tracks each attempt a founder makes at the 100-day program. Implements the miss counter state machine.',
    defaultColumns: ['user', 'attemptNumber', 'status', 'missCount', 'currentDay', 'startedAt'],
    components: {
      views: {
        edit: {
          default: {
            Component: '@/components/Payload/AttemptEditor#default',
          },
          attemptOverview: {
            Component: '@/components/Payload/AttemptViewer#default',
            path: '/overview',
            tab: {
              label: 'All Attempts',
              href: '/overview',
            },
          },
        },
      },
    },
  },
  access: {
    create: ({ req: { user } }) => user?.role === 'admin',
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      // Mentors: scoped to their partner's founders only
      if (user.role === 'mentor') {
        const partnerId = (user as any).partner?.id ?? (user as any).partner
        if (!partnerId) return false // no partner = no access (admin-created mentors must use admin role)
        return { 'user.partner': { equals: partnerId } } as any
      }
      // Partners: see their own partner's founders' attempts
      if (user.role === 'partner') {
        const partnerId = (user as any).partner?.id ?? (user as any).partner
        if (!partnerId) return false
        return { 'user.partner': { equals: partnerId } } as any
      }
      return { user: { equals: user.id } }
    },
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: { description: 'The founder this attempt belongs to.' },
    },
    {
      name: 'cohort',
      type: 'relationship',
      relationTo: 'cohorts',
      admin: { description: 'Cohort at the time this attempt was created (snapshot for history).' },
    },
    {
      name: 'attemptNumber',
      type: 'number',
      required: true,
      min: 1,
      admin: { description: 'Which attempt this is (1, 2, 3, etc.).' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Warned — Miss 1', value: 'warned_1' },
        { label: 'Warned — Miss 2 (LAST)', value: 'warned_2' },
        { label: 'Completed (Day 100)', value: 'completed' },
        { label: 'Failed (max misses reached)', value: 'failed' },
      ],
      index: true,
      admin: {
        description: 'State machine: active → warned_1 → warned_2 → failed OR completed. See PRD Section 5.3.',
      },
    },
    {
      name: 'missCount',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Total missed deadlines in this attempt. Increments at 23:59:59 if no submission. Does NOT decrease on backfill. Max is set by DayProgram config (default 3).',
      },
    },
    {
      name: 'currentDay',
      type: 'number',
      defaultValue: 1,
      min: 1,
      max: 100,
      admin: { description: 'The current day the founder should be working on.' },
    },
    {
      name: 'missedDays',
      type: 'json',
      defaultValue: [],
      admin: {
        description: 'Array of day numbers that were missed. E.g. [5, 12]. Used for attempt history display.',
      },
    },
    {
      name: 'startedAt',
      type: 'date',
      required: true,
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'When this attempt started (Day 1 date). Set from program_start_date = prework_completion_date + 1 day.',
      },
    },
    {
      name: 'endedAt',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'When this attempt ended (failed or completed). Null if still active.',
      },
    },
    {
      name: 'preworkCompletedAt',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'When prework (PW10) was accepted. program_start_date = this + 1 calendar day.',
      },
    },
    {
      name: 'paymentType',
      type: 'select',
      required: true,
      defaultValue: 'self_paid',
      options: [
        { label: 'Self-Paid', value: 'self_paid' },
        { label: 'Paid', value: 'paid' },
        { label: 'Free', value: 'free' },
        { label: 'Test', value: 'test' },
        { label: 'Sponsored', value: 'sponsored' },
        { label: 'Partnership', value: 'partnership' },
      ],
      admin: {
        description: 'Payment type determines attempt allocation (configured in DayProgram global): paid/self_paid, free/test, sponsored/partnership.',
      },
    },
    {
      name: 'partnerOverrideRequestedAt',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Timestamp when partner was notified about ATTEMPT_OVER. Used for 48h/96h reminder logic.',
      },
    },
    {
      name: 'partnerDecision',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Granted Extra Attempt', value: 'granted' },
        { label: 'Process Ended', value: 'ended' },
      ],
      admin: {
        description: 'Partner/Sponsor override decision for sponsored/partnership attempts.',
        condition: (data) => data?.paymentType === 'sponsored' || data?.paymentType === 'partnership',
      },
    },
    // ── Gate Decision Fields ──
    {
      name: 'gateFailedAt',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'When a gate fail decision ended this attempt.',
      },
    },
    {
      name: 'gateRevisionDeadline',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Deadline for resubmission after a gate "revise" decision (48h from decision).',
      },
    },
    {
      name: 'gateRevisionForDay',
      type: 'number',
      min: 1,
      max: 100,
      admin: {
        description: 'Which gate day needs revision (e.g. 15, 30, 50, 70, 94).',
      },
    },
    {
      name: 'partnerReminderSentAt',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Prevents duplicate 48h partner reminders. Set when the first reminder is sent.',
      },
    },
    {
      name: 'certificate',
      type: 'group',
      label: 'Certificate Data',
      admin: {
        description: 'Participant profile details and resolved eligibility for end-of-program certificates.',
      },
      fields: [
        {
          name: 'fullName',
          type: 'text',
          label: 'Full name',
        },
        {
          name: 'companyName',
          type: 'text',
          label: 'Company name',
        },
        {
          name: 'roleTitle',
          type: 'text',
          label: 'Role / title',
        },
        {
          name: 'city',
          type: 'text',
          label: 'City',
        },
        {
          name: 'country',
          type: 'text',
          label: 'Country',
        },
        {
          name: 'consentGrantedAt',
          type: 'date',
          label: 'Consent granted at',
          admin: {
            date: { pickerAppearance: 'dayAndTime' },
          },
        },
        {
          name: 'profileConfirmedAt',
          type: 'date',
          label: 'Profile confirmed at',
          admin: {
            date: { pickerAppearance: 'dayAndTime' },
          },
        },
        {
          name: 'missedSessions',
          type: 'number',
          label: 'Missed sessions',
          defaultValue: 0,
          min: 0,
          admin: {
            description: 'Managed by admin in v1 until session attendance is modeled explicitly.',
          },
        },
        {
          name: 'hadWeekOff',
          type: 'checkbox',
          label: 'Had week off',
          defaultValue: false,
          admin: {
            description: 'A week off disqualifies the participant from receiving a certificate when policy requires it.',
          },
        },
        {
          name: 'kind',
          type: 'select',
          label: 'Resolved certificate kind',
          options: [
            { label: 'None', value: 'none' },
            { label: 'Participation', value: 'participation' },
            { label: 'Completion', value: 'completion' },
          ],
        },
        {
          name: 'resolvedAt',
          type: 'date',
          label: 'Resolved at',
          admin: {
            date: { pickerAppearance: 'dayAndTime' },
          },
        },
        {
          name: 'emailPdfSentAt',
          type: 'date',
          label: 'Certificate PDF email sent at',
          admin: {
            date: { pickerAppearance: 'dayAndTime' },
            description: 'Set automatically after the certificate PDF email is sent.',
          },
        },
        {
          name: 'resolvedBy',
          type: 'relationship',
          relationTo: 'users',
          label: 'Resolved by',
        },
      ],
    },
  ],
}
