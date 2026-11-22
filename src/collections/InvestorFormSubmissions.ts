import type { CollectionConfig } from 'payload'

export const InvestorFormSubmissions: CollectionConfig = {
  slug: 'investor-form-submissions',
  trash: true,
  hooks: {
    beforeChange: [
      ({ req, data }) => {
        // Deliberately block authenticated direct REST/admin writes from
        // non-admins. Submission creation goes through server actions, which
        // normalize partner attribution and validation.
        if (req.user && req.user.role !== 'admin') {
          throw new Error('Direct API writes are disabled for investor form submissions.')
        }
        return data
      },
    ],
  },
  admin: {
    useAsTitle: 'email',
    group: 'User Forms',
    defaultColumns: ['form', 'email', 'partner', 'status', 'createdAt'],
    components: {
      views: {
        edit: {
          default: {
            Component: '@/components/Payload/SubmissionViewer#default',
          },
        },
      },
    },
  },
  access: {
    create: ({ req: { user } }) => Boolean(user),
    read: ({ req: { user } }) => user?.role === 'admin',
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'form',
      type: 'relationship',
      relationTo: 'investor-forms',
      required: true,
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: {
        disableListColumn: true,
        description: 'Internal linked user record.',
      },
    },
    {
      name: 'partner',
      type: 'relationship',
      relationTo: 'partners',
      required: false,
    },
    {
      name: 'email',
      type: 'email',
      label: 'User Email',
      index: true,
    },
    {
      name: 'submissionData',
      type: 'json',
      required: true,
      admin: {
        description: 'Raw submission data (key-value pairs of question_id -> answer)',
      },
    },
    {
      name: 'adminNote',
      type: 'textarea',
      admin: {
        description: 'Internal note visible only to admins',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Reviewed', value: 'reviewed' },
        { label: 'Contacted', value: 'contacted' },
        { label: 'Archived', value: 'archived' },
      ],
    },
  ],
}
