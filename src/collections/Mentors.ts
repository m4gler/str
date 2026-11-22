import type { CollectionConfig } from 'payload'

function relationId(value: unknown): string | number | null {
  if (!value) return null
  if (typeof value === 'object' && 'id' in value) return (value as { id?: string | number }).id ?? null
  if (typeof value === 'string' || typeof value === 'number') return value
  return null
}

export const Mentors: CollectionConfig = {
  slug: 'mentors',
  trash: true,
  admin: {
    useAsTitle: 'title',
    group: 'Platform',
    defaultColumns: ['title', 'landingOrder', 'isActive', 'partner', 'user', 'updatedAt'],
    components: {
      views: {
        edit: {
          default: {
            Component: '@/components/Payload/MentorEditor#default',
          },
        },
      },
    },
  },
  access: {
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'partner',
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user?.role === 'partner') {
        const partnerId = relationId((user as any).partner)
        if (!partnerId) return false
        return {
          or: [
            { partner: { equals: partnerId } },
            { partner: { exists: false } },
          ],
        } as any
      }
      if (user?.role === 'mentor') {
        const partnerId = relationId((user as any).partner)
        return {
          or: [
            { user: { equals: user.id } },
            ...(partnerId ? [{ partner: { equals: partnerId } }] : []),
          ],
        } as any
      }
      return { isActive: { equals: true } }
    },
    update: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user?.role === 'partner') {
        const partnerId = relationId((user as any).partner)
        if (!partnerId) return false
        return { partner: { equals: partnerId } }
      }
      return false
    },
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      defaultValue: 'Mentor',
    },
    {
      name: 'landingOrder',
      type: 'number',
      label: 'Order',
      defaultValue: 0,
      admin: {
        description: 'Lower numbers appear first in the landing page mentor row.',
      },
    },
    {
      name: 'profileImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Profile Image',
      admin: {
        description: 'Square image used for this mentor card on the landing page.',
      },
    },
    {
      name: 'linkUrl',
      type: 'text',
      label: 'Link URL',
      admin: {
        description: 'Optional destination when this mentor card is clicked. Use an internal path like /mentor/name or a full URL.',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      label: 'Show this mentor',
      admin: {
        description: 'Controls whether this mentor profile can be displayed publicly or on user accounts.',
      },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      label: 'Mentor User',
      admin: {
        description: 'Optional user account behind this visual mentor profile.',
      },
    },
    {
      name: 'partner',
      type: 'relationship',
      relationTo: 'partners',
      label: 'Partner',
      admin: {
        description: 'Partner that owns this mentor profile. Empty means global/admin mentor.',
      },
    },
  ],
}
