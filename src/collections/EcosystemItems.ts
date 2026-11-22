import type { CollectionConfig } from 'payload'

export const EcosystemItems: CollectionConfig = {
  slug: 'ecosystem-items',
  trash: true,
  admin: {
    useAsTitle: 'name',
    group: '📅 Day Program',
    description: 'Local ecosystem map entries: groups, places, events, angels/VCs, operators. Founders build these during prework and throughout the program.',
    defaultColumns: ['name', 'itemType', 'user', 'status', 'priority', 'createdAt'],
    components: {
      views: {
        edit: {
          default: {
            Component: '@/components/Payload/EcosystemItemEditor#default',
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
      // Founders see their own items
      return { user: { equals: user.id } }
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return { user: { equals: user.id } }
    },
    delete: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return { user: { equals: user.id } }
    },
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: { description: 'Founder who added this ecosystem item.' },
    },
    {
      name: 'itemType',
      type: 'select',
      required: true,
      options: [
        { label: 'Online Group', value: 'online_group' },
        { label: 'Physical Place / Coworking', value: 'physical_place' },
        { label: 'Upcoming Event', value: 'event' },
        { label: 'Angel / VC / Fund', value: 'angel_vc' },
        { label: 'Operator / Mentor', value: 'operator' },
        { label: 'Signal Account (Twitter/LinkedIn)', value: 'signal_account' },
      ],
      index: true,
      admin: { description: 'Category of the ecosystem item.' },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: { description: 'Name of the group, place, event, person, or account.' },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: { description: 'Brief description or relevance to the founder\'s project.' },
    },
    {
      name: 'url',
      type: 'text',
      admin: { description: 'Link to the group, event page, LinkedIn profile, etc.' },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'identified',
      options: [
        { label: 'Identified', value: 'identified' },
        { label: 'Contacted', value: 'contacted' },
        { label: 'Engaged', value: 'engaged' },
        { label: 'Active Relationship', value: 'active' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: { description: 'Progress status of engagement with this ecosystem item.' },
    },
    {
      name: 'priority',
      type: 'select',
      defaultValue: 'medium',
      options: [
        { label: 'High', value: 'high' },
        { label: 'Medium', value: 'medium' },
        { label: 'Low', value: 'low' },
      ],
      admin: { description: 'Priority for outreach / engagement.' },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: { description: 'Free-form notes about interactions, follow-ups, etc.' },
    },
    {
      name: 'eventDate',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayOnly' },
        description: 'Date of the event (only for event type items).',
        condition: (data) => data?.itemType === 'event',
      },
    },
    {
      name: 'location',
      type: 'group',
      admin: { description: 'Location for mapping (physical places and events).' },
      fields: [
        { name: 'city', type: 'text', label: 'City' },
        { name: 'country', type: 'text', label: 'Country' },
        {
          name: 'lat',
          type: 'number',
          label: 'Latitude',
          admin: { step: 0.000001 },
        },
        {
          name: 'lng',
          type: 'number',
          label: 'Longitude',
          admin: { step: 0.000001 },
        },
      ],
    },
  ],
}
