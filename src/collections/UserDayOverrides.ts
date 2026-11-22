import type { CollectionConfig } from 'payload'

export const UserDayOverrides: CollectionConfig = {
  slug: 'user-day-overrides',
  trash: true,
  admin: {
    useAsTitle: 'note',
    group: '📅 Day Program',
    description: 'Override the scheduled form for a specific user on a specific day.',
    defaultColumns: ['user', 'day', 'form', 'note', 'updatedAt'],
  },
  access: {
    read: ({ req: { user } }) => user?.role === 'admin',
    create: ({ req: { user } }) => user?.role === 'admin',
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
      admin: {
        description: 'The founder to override.',
      },
    },
    {
      name: 'day',
      type: 'number',
      required: true,
      index: true,
      min: 1,
      max: 100,
      admin: {
        description: 'Program day number (1–100).',
      },
    },
    {
      name: 'form',
      type: 'relationship',
      relationTo: 'founder-forms',
      required: true,
      admin: {
        description: 'The founder-form to show this user on this day, overriding the default/archetype schedule.',
      },
    },
    {
      name: 'note',
      type: 'textarea',
      admin: {
        description: 'Internal admin note (optional). Displayed as the document title in the admin list.',
      },
    },
  ],
}
