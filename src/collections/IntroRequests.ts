import type { CollectionConfig } from 'payload'

export const IntroRequests: CollectionConfig = {
  slug: 'intro-requests',
  trash: true,
  admin: {
    useAsTitle: 'targetName',
    group: '📅 Day Program',
    description: 'Founder requests for introductions to ecosystem contacts. Routed through admin to mentors.',
    defaultColumns: ['targetName', 'user', 'status', 'assignedTo', 'createdAt'],
    components: {
      views: {
        edit: {
          default: {
            Component: '@/components/Payload/IntroRequestEditor#default',
          },
        },
      },
    },
  },
  access: {
    create: ({ req: { user } }) => {
      if (!user) return false
      return user.role === 'founder' || user.role === 'admin'
    },
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      // Founders see their own requests
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
      admin: { description: 'Founder who requested the introduction.' },
    },
    {
      name: 'targetName',
      type: 'text',
      required: true,
      admin: { description: 'Name of the person/organization the founder wants an intro to.' },
    },
    {
      name: 'targetRole',
      type: 'text',
      admin: { description: 'Role/title of the target, e.g. "Partner at XYZ VC".' },
    },
    {
      name: 'targetOrganization',
      type: 'text',
      admin: { description: 'Organization the target belongs to.' },
    },
    {
      name: 'targetUrl',
      type: 'text',
      admin: { description: 'LinkedIn or other profile URL for the target.' },
    },
    {
      name: 'reason',
      type: 'textarea',
      required: true,
      admin: { description: 'Why the founder wants this introduction — what they hope to achieve.' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'requested',
      options: [
        { label: 'Requested', value: 'requested' },
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Completed', value: 'completed' },
        { label: 'Declined', value: 'declined' },
      ],
      index: true,
      admin: { description: 'Current status of the intro request.' },
    },
    {
      name: 'assignedTo',
      type: 'relationship',
      relationTo: 'users',
      admin: { description: 'Admin/mentor assigned to facilitate this introduction.' },
    },
    {
      name: 'adminNotes',
      type: 'textarea',
      admin: { description: 'Internal notes from admin about the request progress.' },
    },
    {
      name: 'completedAt',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'When the introduction was completed.',
        condition: (data) => data?.status === 'completed',
      },
    },
    {
      name: 'declineReason',
      type: 'textarea',
      admin: {
        description: 'Reason for declining the request.',
        condition: (data) => data?.status === 'declined',
      },
    },
  ],
}
