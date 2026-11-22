import type { CollectionConfig } from 'payload'

export const Tracks: CollectionConfig = {
  slug: 'tracks',
  trash: true,
  admin: {
    useAsTitle: 'name',
    group: '📅 Day Program',
    description: 'Program tracks. Slugs must match the track value stored on project submissions.',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => user?.role === 'admin',
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Unique identifier used in schedules and submissions (e.g. "general", "space", "it").' },
    },
    { name: 'isActive', type: 'checkbox', defaultValue: true, admin: { description: 'Only active tracks appear in the project submission form.' } },
    {
      name: 'rulesetVersion',
      type: 'text',
      admin: { description: 'Version of the curriculum ruleset for this track (e.g. "v1.0").' },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: { description: 'Description of this track and its focus areas.' },
    },
  ],
}
