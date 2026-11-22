import type { GlobalConfig } from 'payload'
import { CURRICULUM_DEFAULT_RELEASE_KEY } from '@/lib/curriculum/constants'

export const DayProgram: GlobalConfig = {
  slug: 'day-program',
  admin: {
    group: '📅 Day Program',
    components: {
      views: {
        edit: {
          default: {
            Component: '@/components/Payload/DayProgramEditor#default',
          },
        },
      },
    },
  },
  access: {
    read: ({ req: { user } }) => user?.role === 'admin',
    update: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'scheduleHierarchy',
      type: 'array',
      label: 'Schedule Hierarchy',
      minRows: 1,
      maxRows: 4,
      admin: {
        description: 'Priority order for day schedule resolution. Top = highest priority. At least one level required. "general" uses the Default Schedule below.',
        initCollapsed: false,
      },
      defaultValue: [
        { level: 'partner' },
        { level: 'track' },
        { level: 'archetype' },
        { level: 'general' },
      ],
      fields: [
        {
          name: 'level',
          type: 'select',
          required: true,
          options: [
            { label: 'Partner-specific schedule', value: 'partner' },
            { label: 'Track-specific schedule', value: 'track' },
            { label: 'Archetype-specific schedule', value: 'archetype' },
            { label: 'General / default schedule', value: 'general' },
          ],
        },
      ],
    },
    {
      name: 'activeCurriculumReleaseKey',
      type: 'text',
      label: 'Active Curriculum Release',
      defaultValue: CURRICULUM_DEFAULT_RELEASE_KEY,
      admin: {
        description: `Release key used by curriculum resolution, sourced from the Excel META tab (for example "${CURRICULUM_DEFAULT_RELEASE_KEY}").`,
      },
    },
    {
      name: 'dailyReleaseTime',
      type: 'text',
      label: 'Daily Task Release Time (CET)',
      defaultValue: '12:00',
      required: true,
      admin: {
        description:
          'Time of day (HH:MM, 24h format) in Europe/Warsaw timezone when the next daily task becomes available. Default: 12:00 (noon CET).',
      },
      validate: (val: unknown) => {
        if (!val || typeof val !== 'string') return 'Required'
        if (!/^\d{2}:\d{2}$/.test(val)) return 'Must be in HH:MM format (e.g. 12:00)'
        const [h, m] = val.split(':').map(Number)
        if (h < 0 || h > 23 || m < 0 || m > 59) return 'Invalid time'
        return true
      },
    },
    {
      name: 'defaultSchedule',
      type: 'json',
      label: 'Default 100-Day Schedule',
      admin: {
        description: 'Managed via the visual editor above. Format: { "1": formId, "2": formId, ... }',
      },
    },
    {
      name: 'preworkSchedule',
      type: 'json',
      label: 'Prework Schedule',
      admin: {
        description: 'Managed via the visual editor. Format: { "1": formId, "2": formId, ... } for PW01–PW10.',
      },
    },

    // ── Attempt & Miss Configuration (PRD Section 5) ──
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Attempt & Miss Rules',
          fields: [
            {
              name: 'maxMissesPerAttempt',
              type: 'number',
              label: 'Max Misses Per Attempt',
              defaultValue: 3,
              required: true,
              min: 1,
              admin: {
                description: 'Number of missed deadlines before an attempt is automatically failed. Default: 3 (PRD Section 5.3).',
              },
            },
            {
              name: 'backfillWindowDays',
              type: 'number',
              label: 'Backfill Window (days)',
              defaultValue: 1,
              required: true,
              min: 0,
              max: 7,
              admin: {
                description: 'How many days after a missed deadline the founder can submit a backfill. Default: 1 (submit Day N until end of Day N+1). PRD Section 5.2.',
              },
            },
            {
              name: 'gateDays',
              type: 'json',
              label: 'Gate Days',
              defaultValue: [15, 30, 50, 70, 94],
              admin: {
                description: 'JSON array of day numbers that are IC Gate checkpoints. Default: [15, 30, 50, 70, 94]. PRD Section 5.',
              },
            },
            {
              name: 'retroEveryNDays',
              type: 'number',
              label: 'Retro Every N Days',
              defaultValue: 7,
              required: true,
              min: 1,
              admin: {
                description: 'Retro day occurs when day_number % N == 0. Default: 7 (weekly retro). PRD Section 3B.1.',
              },
            },
            {
              name: 'totalProgramDays',
              type: 'number',
              label: 'Total Program Days',
              defaultValue: 100,
              required: true,
              min: 1,
              admin: {
                description: 'Total number of days in the program. Default: 100.',
              },
            },
            {
              name: 'totalPreworkBlocks',
              type: 'number',
              label: 'Total Prework Blocks',
              defaultValue: 10,
              required: true,
              min: 1,
              admin: {
                description: 'Number of prework blocks (PW01–PW10). Default: 10.',
              },
            },
            {
              name: 'attemptLimits',
              type: 'group',
              label: 'Attempt Limits by Payment Type',
              admin: {
                description: 'Maximum attempts per payment type. PRD Section 5.6.',
              },
              fields: [
                {
                  name: 'selfPaid',
                  type: 'number',
                  label: 'Self-Paid / Paid',
                  defaultValue: 3,
                  required: true,
                  min: 1,
                  admin: { description: 'Max attempts for self_paid and paid users. Default: 3.' },
                },
                {
                  name: 'free',
                  type: 'number',
                  label: 'Free / Test',
                  defaultValue: 1,
                  required: true,
                  min: 1,
                  admin: { description: 'Max attempts for free and test users. Default: 1.' },
                },
                {
                  name: 'sponsoredDefault',
                  type: 'number',
                  label: 'Sponsored / Partnership (default)',
                  defaultValue: 1,
                  required: true,
                  min: 1,
                  admin: { description: 'Default max attempts for sponsored/partnership (can be overridden per cohort by admin). Default: 1.' },
                },
              ],
            },
            {
              name: 'partnerOverrideDeadlineHours',
              type: 'number',
              label: 'Partner Override Deadline (hours)',
              defaultValue: 48,
              required: true,
              min: 1,
              admin: {
                description: 'Hours partner has to make an override decision before a reminder is sent. Default: 48h. PRD Section 5.5.',
              },
            },
            {
              name: 'partnerOverrideEscalationHours',
              type: 'number',
              label: 'Partner Escalation to Admin (hours)',
              defaultValue: 96,
              required: true,
              min: 1,
              admin: {
                description: 'Hours after ATTEMPT_OVER before admin is notified if partner hasn\'t responded. Default: 96h. PRD Section 5.5.',
              },
            },
            {
              name: 'certificatePolicy',
              type: 'group',
              label: 'Certificate Policy',
              admin: {
                description: 'Rules for end-of-program certificate eligibility. These values are used by the dashboard and admin tools instead of hardcoded thresholds.',
              },
              fields: [
                {
                  name: 'enabled',
                  type: 'checkbox',
                  label: 'Enable certificates',
                  defaultValue: true,
                },
                {
                  name: 'missedSessionsThreshold',
                  type: 'number',
                  label: 'Missed sessions threshold',
                  defaultValue: 3,
                  required: true,
                  min: 1,
                  admin: {
                    description: 'Participants with this many or more missed sessions are eligible only for a participation certificate.',
                  },
                },
                {
                  name: 'weekOffDisqualifies',
                  type: 'checkbox',
                  label: 'Week off disqualifies certificate',
                  defaultValue: true,
                  admin: {
                    description: 'If enabled, a recorded week off means no certificate is issued.',
                  },
                },
                {
                  name: 'showOnDashboard',
                  type: 'checkbox',
                  label: 'Show certificate on founder dashboard',
                  defaultValue: false,
                  admin: {
                    description: 'When enabled, founders can see their resolved certificate status after the attempt ends. Disabled by default.',
                  },
                },
                {
                  name: 'emailPdfEnabled',
                  type: 'checkbox',
                  label: 'Email certificate PDF',
                  defaultValue: false,
                  admin: {
                    description: 'Reserved for automatic certificate PDF email delivery. Keep disabled until PDF sending is ready to run.',
                  },
                },
                {
                  name: 'completionLabel',
                  type: 'text',
                  label: 'Completion label',
                  defaultValue: 'completion',
                },
                {
                  name: 'participationLabel',
                  type: 'text',
                  label: 'Participation label',
                  defaultValue: 'participation',
                },
              ],
            },
          ],
        },
        {
          label: 'AI & Auto-Check',
          fields: [
            {
              name: 'aiModel',
              type: 'text',
              label: 'AI Model for Summaries',
              defaultValue: 'gpt-4o-mini',
              admin: {
                description: 'OpenAI model ID for generating submission summaries. Default: gpt-4o-mini (cost-effective). PRD OD-4.',
              },
            },
            {
              name: 'aiEnabled',
              type: 'checkbox',
              label: 'Enable AI Summaries',
              defaultValue: true,
              admin: {
                description: 'Toggle AI summary generation on/off. When disabled, submissions still work but without auto-summary.',
              },
            },
            {
              name: 'minExcerptLength',
              type: 'number',
              label: 'Min Excerpt Length (chars)',
              defaultValue: 50,
              required: true,
              min: 0,
              admin: {
                description: 'Minimum character count for "paste excerpt" field. PRD Section 5.1 says 50. Set 0 to disable.',
              },
            },
            {
              name: 'linkCheckTimeoutMs',
              type: 'number',
              label: 'Link Check Timeout (ms)',
              defaultValue: 5000,
              required: true,
              min: 1000,
              admin: {
                description: 'Timeout for HEAD request when checking artifact link reachability. Default: 5000ms. PRD Section 6.',
              },
            },
            {
              name: 'skipReachabilityDomains',
              type: 'json',
              label: 'Skip Reachability Domains',
              defaultValue: ['figma.com', 'notion.so', 'notion.site', 'docs.google.com', 'drive.google.com', 'sheets.google.com', 'slides.google.com'],
              admin: {
                description: 'JSON array of domains where link reachability check is skipped (only format validated). PRD Section 6.',
              },
            },
            {
              name: 'videoDomains',
              type: 'json',
              label: 'Video Link Domains',
              defaultValue: ['youtube.com', 'youtu.be', 'loom.com', 'vimeo.com'],
              admin: {
                description: 'JSON array of domains recognized as video_link proof type.',
              },
            },
            {
              name: 'audioDomains',
              type: 'json',
              label: 'Audio Link Domains',
              defaultValue: ['spotify.com', 'soundcloud.com', 'anchor.fm'],
              admin: {
                description: 'JSON array of domains recognized as audio_link proof type.',
              },
            },
          ],
        },
      ],
    },
  ],
}
