import type { CollectionConfig } from 'payload'

export const Teams: CollectionConfig = {
  slug: 'teams',
  trash: true,
  admin: {
    useAsTitle: 'name',
    group: '📅 Day Program',
    description: 'Teams group founders within a cohort. Tracks payment status and attempt allocation per PRD Section 4.',
    defaultColumns: ['name', 'cohort', 'paymentStatus', 'attemptsUsed', 'maxAttempts', 'isActive'],
  },
  access: {
    create: ({ req: { user } }) => user?.role === 'admin',
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      // Partners can read teams linked to them
      if (user.role === 'partner') {
        const partnerId = (user as any).partner?.id ?? (user as any).partner
        if (!partnerId) return false
        return { partner: { equals: partnerId } } as any
      }
      // Mentors can read all teams
      if (user.role === 'mentor') return true
      // Founders can read their own team
      return { members: { contains: user.id } } as any
    },
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: { description: 'Team display name.' },
    },
    {
      name: 'cohort',
      type: 'relationship',
      relationTo: 'cohorts',
      required: true,
      index: true,
      admin: { description: 'The cohort this team belongs to.' },
    },
    {
      name: 'partner',
      type: 'relationship',
      relationTo: 'partners',
      admin: { description: 'Partner/Sponsor associated with this team. Determines payment type and attempt override rules.' },
    },
    {
      name: 'members',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      admin: { description: 'Founders in this team.' },
    },
    {
      name: 'paymentStatus',
      type: 'select',
      required: true,
      defaultValue: 'self_paid',
      options: [
        { label: 'Self-Paid', value: 'self_paid' },
        { label: 'Partner Access', value: 'partner_access' },
        { label: 'Free', value: 'free' },
      ],
      admin: {
        description: 'Payment status for this team. Determines attempt allocation: self_paid → 3, partner_access/free → per config.',
      },
    },
    {
      name: 'attemptsUsed',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: { description: 'How many attempts this team has used so far.' },
    },
    {
      name: 'maxAttempts',
      type: 'number',
      required: true,
      defaultValue: 3,
      min: 1,
      admin: {
        description: 'Maximum attempts for this team. Defaults: self_paid=3, free=1, partner_access=custom. Overrides global DayProgram config.',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Whether this team is active in the program.' },
    },
  ],
}
