import { randomBytes } from 'crypto'
import type { CollectionConfig } from 'payload'

function resolveUserPartnerId(user: any): number | string | null {
  return user?.partner?.id ?? user?.partner ?? null
}

export const PartnerInviteLinks: CollectionConfig = {
  slug: 'partner-invite-links',
  trash: true,
  admin: {
    useAsTitle: 'label',
    group: 'Platform',
    defaultColumns: ['label', 'partner', 'track', 'isActive', 'useCount', 'lastUsedAt'],
  },
  access: {
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'partner',
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      if (user.role !== 'partner') return false

      const partnerId = resolveUserPartnerId(user)
      return partnerId ? { partner: { equals: partnerId } } : false
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      if (user.role !== 'partner') return false

      const partnerId = resolveUserPartnerId(user)
      return partnerId ? { partner: { equals: partnerId } } : false
    },
    delete: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      if (user.role !== 'partner') return false

      const partnerId = resolveUserPartnerId(user)
      return partnerId ? { partner: { equals: partnerId } } : false
    },
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
        description: 'Public-safe token used in /invite/private/[token].',
      },
    },
    {
      name: 'partner',
      type: 'relationship',
      relationTo: 'partners',
      required: true,
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
