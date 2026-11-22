import type { CollectionConfig } from 'payload'

export const StatisticsEmailTemplates: CollectionConfig = {
  slug: 'statistics-email-templates',
  labels: {
    singular: 'Statistics Email Template',
    plural: 'Statistics Email Templates',
  },
  admin: {
    useAsTitle: 'name',
    group: '📊 Admin Tools',
    defaultColumns: ['name', 'subject', 'group', 'updatedAt'],
  },
  access: {
    read: ({ req: { user } }) => user?.role === 'admin',
    create: ({ req: { user } }) => user?.role === 'admin',
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'subject',
      type: 'text',
      required: true,
    },
    {
      name: 'body',
      type: 'textarea',
      required: true,
      admin: {
        description: 'Available variables: {{email}}, {{track}}, {{partner}}, {{personality}}, {{status}}.',
      },
    },
    {
      name: 'group',
      type: 'select',
      required: true,
      defaultValue: 'all',
      options: [
        { label: 'All filtered founders', value: 'all' },
        { label: 'Pre-program / prework', value: 'preprogram' },
        { label: 'Started 100 Days', value: 'started' },
        { label: 'Active 100 Days', value: 'active' },
        { label: 'Finished', value: 'finished' },
        { label: 'Failed / dropped', value: 'failed' },
      ],
      admin: {
        description: 'Default recipient group restored when this template is selected on Statistics.',
      },
    },
    {
      name: 'trackId',
      type: 'text',
      label: 'Default Track Filter ID',
      admin: {
        description: 'Saved from the Statistics email track selector.',
      },
    },
    {
      name: 'personality',
      type: 'text',
      label: 'Default Personality Filter',
      admin: {
        description: 'Saved from the Statistics email personality selector.',
      },
    },
    {
      name: 'founderId',
      type: 'text',
      label: 'Default Founder Filter ID',
      admin: {
        description: 'Legacy single-founder filter. New templates use Founder IDs.',
      },
    },
    {
      name: 'founderIds',
      type: 'array',
      label: 'Default Founder Filter IDs',
      fields: [
        {
          name: 'founderId',
          type: 'text',
          required: true,
        },
      ],
      admin: {
        description: 'Saved from the Statistics multi-founder selector.',
      },
    },
  ],
}
