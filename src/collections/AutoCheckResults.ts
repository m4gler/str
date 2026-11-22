import type { CollectionConfig } from 'payload'

export const AutoCheckResults: CollectionConfig = {
  slug: 'auto-check-results',
  trash: true,
  admin: {
    useAsTitle: 'id',
    group: '📅 Day Program',
    description: 'AI-generated summaries and auto-check results for each daily submission.',
    defaultColumns: ['submission', 'user', 'dayNumber', 'checksPassed', 'linkReachable', 'createdAt'],
    components: {
      views: {
        edit: {
          default: {
            Component: '@/components/Payload/AutoCheckResultViewer#default',
          },
        },
      },
    },
  },
  access: {
    create: ({ req: { user } }) => user?.role === 'admin',
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      // Founders can read their own results
      return { user: { equals: user.id } }
    },
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'submission',
      type: 'relationship',
      relationTo: 'founder-form-submissions',
      required: true,
      index: true,
      admin: { description: 'The daily submission this auto-check result is for.' },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'attempt',
      type: 'relationship',
      relationTo: 'attempts',
      admin: { description: 'The attempt this result belongs to.' },
    },
    {
      name: 'dayNumber',
      type: 'number',
      required: true,
      min: 1,
      max: 100,
      index: true,
      admin: { description: 'Program day number (1–100).' },
    },
    {
      name: 'checksPassed',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Whether all auto-checks passed (required fields, link format, excerpt length).' },
    },
    {
      name: 'linkReachable',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Whether the artifact link returned a successful HEAD response.' },
    },
    {
      name: 'linkUrl',
      type: 'text',
      admin: { description: 'The artifact link that was checked.' },
    },
    {
      name: 'proofType',
      type: 'select',
      options: [
        { label: 'Link (URL)', value: 'link' },
        { label: 'Video Link', value: 'video_link' },
        { label: 'PDF Upload', value: 'file_pdf' },
        { label: 'PPT Upload', value: 'file_ppt' },
        { label: 'DOC Upload', value: 'file_doc' },
        { label: 'Text (paste excerpt)', value: 'text' },
        { label: 'Audio Link', value: 'audio_link' },
      ],
      admin: { description: 'The proof format used for this submission.' },
    },
    {
      name: 'aiSummary',
      type: 'json',
      admin: {
        description: 'AI-generated summary JSON: { summary_3s, key_output, decision, learnings, mentor_ask, checks_passed, link_reachable, generated_at }',
      },
    },
    {
      name: 'autoCheckDetails',
      type: 'json',
      admin: {
        description: 'Detailed auto-check results: { fieldValidation: [...], linkCheck: {...}, excerptLength: number }',
      },
    },
    {
      name: 'errorMessage',
      type: 'text',
      admin: {
        description: 'If auto-check failed, the user-facing error message (e.g. "Link returned 404").',
      },
    },
  ],
}
