import type { CollectionConfig } from 'payload'
import { after } from 'next/server'
import { getAppUrl } from '@/lib/appUrl'
import { buildFounderPersonalityStatusAlertEvent, queueFounderStatusAlert } from '@/lib/founderStatusAlerts'

function relationId(value: unknown): string | null {
    if (value && typeof value === 'object' && 'id' in value) return String((value as any).id)
    if (value == null) return null
    return String(value)
}

function scheduleBackgroundTask(task: () => Promise<void>): void {
    try {
        after(task)
    } catch (error) {
        if (error instanceof Error && error.message.includes('outside a request scope')) {
            void Promise.resolve().then(task)
            return
        }
        throw error
    }
}

export const FounderFormSubmissions: CollectionConfig = {
    slug: 'founder-form-submissions',
    trash: true,
    hooks: {
        beforeChange: [
            ({ req, data }) => {
                // Deliberately block authenticated direct REST/admin writes from
                // non-admins. Submission creation goes through server actions,
                // which compute day state, backfill, and auto-check metadata.
                if (req.user && req.user.role !== 'admin') {
                    throw new Error('Direct API writes are disabled for founder form submissions.')
                }
                return data
            },
        ],
        afterChange: [
            async ({ doc, operation, req }) => {
                if (operation !== 'create') return doc
                if (req.context?.skipFounderStatusAlert === true) return doc

                const userId = relationId(doc.user)
                const formId = relationId(doc.form)
                if (!userId || !formId) return doc

                scheduleBackgroundTask(async () => {
                    try {
                        const settings = await req.payload.findGlobal({ slug: 'platform-settings' }).catch(() => null) as any
                        const personalityFormId = relationId(settings?.activePersonalityTestForm)
                        if (!personalityFormId || personalityFormId !== formId) return

                        await queueFounderStatusAlert(
                            req.payload,
                            userId,
                            buildFounderPersonalityStatusAlertEvent(),
                            getAppUrl(),
                        )
                    } catch (err) {
                        console.warn('[FounderFormSubmissions] Failed to send founder personality status alert', doc.id, err)
                    }
                })

                return doc
            },
        ],
    },
  admin: {
    useAsTitle: 'email',
    group: 'User Forms',
    defaultColumns: ['form', 'email', 'partner', 'programDay', 'status', 'createdAt'],
    components: {
      views: {
        edit: {
          default: {
            Component: '@/components/Payload/SubmissionViewer#default',
          },
        },
      },
    },
  },
    access: {
        create: ({ req: { user } }) => Boolean(user),
        read: ({ req: { user } }) => {
            if (!user) return false
            if (user.role === 'admin') return true
            // Mentors: admin-created (no partner) see all; partner mentors see only their partner's submissions
            if (user.role === 'mentor') {
                const partnerId = (user as any).partner?.id ?? (user as any).partner
                if (!partnerId) return true // admin-created mentor — see all
                return { partner: { equals: partnerId } }
            }
            // Partners: see their own partner's submissions
            if (user.role === 'partner') {
                const partnerId = (user as any).partner?.id ?? (user as any).partner
                if (!partnerId) return false
                return { partner: { equals: partnerId } }
            }
            return false
        },
        update: ({ req: { user } }) => user?.role === 'admin',
        delete: ({ req: { user } }) => user?.role === 'admin',
    },
    fields: [
    {
      name: 'form',
      type: 'relationship',
      relationTo: 'founder-forms',
      required: true,
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: {
        disableListColumn: true,
        description: 'Internal linked user record.',
      },
    },
    {
      name: 'partner',
      type: 'relationship',
      relationTo: 'partners',
      required: false,
    },
    {
      name: 'email',
      type: 'email',
      label: 'User Email',
      index: true,
    },
    {
      name: 'submissionData',
      type: 'json',
      required: true,
      admin: {
        description: 'Raw submission data (key-value pairs of question_id -> answer)',
      },
    },
    {
      name: 'programDay',
      type: 'number',
      min: 1,
      max: 100,
      index: true,
      admin: {
        description: 'Which day of the 100-day program this submission was for (auto-set on submit).',
      },
    },
    {
      name: 'isBackfill',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: {
        description: 'True if this submission was filed after the original deadline (backfill). Does NOT reduce miss_count.',
      },
    },
    {
      name: 'missedCounted',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'True if this day was already counted as a miss before the backfill submission.',
      },
    },
    {
      name: 'attempt',
      type: 'relationship',
      relationTo: 'attempts',
      index: true,
      admin: {
        description: 'The attempt this submission belongs to.',
      },
    },
    {
      name: 'dayType',
      type: 'select',
      options: [
        { label: 'Standard', value: 'standard' },
        { label: 'Retro', value: 'retro' },
        { label: 'Gate', value: 'gate' },
        { label: 'Prework', value: 'prework' },
      ],
      admin: {
        description: 'System-calculated day type. retro=day%7==0, gate=day IN (15,30,50,70,94), prework=day≤0, else standard.',
      },
    },
    {
      name: 'adminNote',
      type: 'textarea',
      admin: {
        description: 'Internal note visible only to admins',
      },
    },
    {
      name: 'personalityScores',
      type: 'json',
      admin: {
        description: 'Computed personality scores (auto-calculated on submission)',
      },
    },
    {
      name: 'archetype',
      type: 'text',
      index: true,
      admin: {
        description: 'Auto-assigned personality archetype key (matches PlatformSettings archetype key — do not edit manually)',
      },
    },
    {
      name: 'track',
      type: 'select',
      options: [
        { label: 'Operator Track', value: 'Operator Track' },
        { label: 'Explorer Track', value: 'Explorer Track' },
        { label: 'Support Track', value: 'Support Track' },
        { label: 'Starter Track', value: 'Starter Track' },
      ],
      index: true,
      admin: {
        description: 'Auto-assigned development track',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Reviewed', value: 'reviewed' },
        { label: 'Contacted', value: 'contacted' },
        { label: 'Archived', value: 'archived' },
      ],
    },
  ],
}
