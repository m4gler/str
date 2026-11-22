import type { CollectionConfig } from 'payload'

export const Cohorts: CollectionConfig = {
  slug: 'cohorts',
  trash: true,
  admin: {
    useAsTitle: 'name',
    group: '📅 Day Program',
    description: 'Cohorts group founders with shared start dates, timezones, and partner assignments.',
    defaultColumns: ['name', 'timezone', 'startDate', 'preworkStartDate', 'partner', 'isActive'],
    components: {
      views: {
        edit: {
          default: {
            Component: '@/components/Payload/CohortEditor#default',
          },
        },
      },
    },
  },
  access: {
    create: ({ req: { user } }) => user?.role === 'admin',
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin' || user.role === 'mentor') return true
      if (user.role === 'partner') {
        const partnerId = (user as any).partner?.id ?? (user as any).partner
        if (partnerId) return { partner: { equals: partnerId } }
        return false
      }
      // Founders/investors can read their own cohort via dashboard queries
      return Boolean(user)
    },
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: { description: 'Cohort display name, e.g. "Spring 2026 — Warsaw"' },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'URL-safe identifier for the cohort' },
    },
    {
      name: 'timezone',
      type: 'text',
      required: true,
      defaultValue: 'Europe/Warsaw',
      admin: {
        description: 'IANA timezone for this cohort. All deadlines (23:59:59) are calculated in this timezone.',
      },
    },
    {
      name: 'startDate',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayOnly' },
        description: 'Planned Day 1 start date for the cohort (informational — actual start depends on prework completion).',
      },
    },
    {
      name: 'preworkStartDate',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayOnly' },
        description: 'Date when prework becomes available to cohort members.',
      },
    },
    {
      name: 'partner',
      type: 'relationship',
      relationTo: 'partners',
      admin: {
        description: 'Partner/Sponsor associated with this cohort. Determines payment type and attempt override rules.',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Only active cohorts accept new members and participate in day-program reminder/deadline automation.' },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: { description: 'Internal notes about this cohort.' },
    },
    {
      name: 'maxMembers',
      type: 'number',
      admin: { description: 'Optional cap on cohort membership. Leave blank for unlimited.' },
    },
  ],
}
