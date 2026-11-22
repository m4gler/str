import { randomBytes } from 'crypto'
import type { CollectionConfig } from 'payload'

export const TrackInviteLinks: CollectionConfig = {
  slug: 'track-invite-links',
  trash: true,
  admin: {
    useAsTitle: 'label',
    group: 'Platform',
    defaultColumns: ['label', 'track', 'isActive', 'useCount', 'lastUsedAt'],
  },
  access: {
    create: ({ req: { user } }) => user?.role === 'admin',
    read: ({ req: { user } }) => user?.role === 'admin',
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create' && typeof data.token !== 'string') {
          data.token = randomBytes(12).toString('hex')
        }
        if (operation === 'create' && typeof data.useCount !== 'number') {
          data.useCount = 0
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'label',
      type: 'text',
      required: true,
    },
    {
      name: 'token',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description: 'Auto-generated token used in /invite/track-private/[token].',
      },
    },
    {
      name: 'track',
      type: 'relationship',
      relationTo: 'tracks',
      required: true,
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'lastUsedAt',
      type: 'date',
      admin: {
        readOnly: true,
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'useCount',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
      },
    },
  ],
}
