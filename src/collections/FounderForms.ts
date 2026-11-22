
import type { CollectionConfig } from 'payload'

export const FounderForms: CollectionConfig = {
  slug: 'founder-forms',
  trash: true,
  admin: {
    useAsTitle: 'title',
    listSearchableFields: ['title', 'slug'],
    group: 'User Forms',
    components: {
        views: {
            edit: {
                default: {
                    Component: '@/components/Payload/FormEditor#default',
                },
                statistics: {
                    Component: '@/components/Payload/StatisticsViewer#default',
                    path: '/statistics',
                    tab: {
                        label: 'Statistics',
                        href: '/statistics',
                    },
                }
            }
        }
    }
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => user?.role === 'admin',
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'showReferredBy',
      type: 'checkbox',
      label: 'Show "Referred from" Field',
      defaultValue: false,
      admin: {
        description: 'Show a partner/referral dropdown at the top of this form.',
        position: 'sidebar',
      },
    },
    {
      name: 'allowMultipleSubmissions',
      type: 'checkbox',
      label: 'Allow Multiple Submissions',
      defaultValue: false,
      admin: {
        description: 'If checked, the same user can submit this form more than once. Useful for repeatable daily or weekly forms.',
        position: 'sidebar',
      },
    },
    {
      name: 'sections',
      type: 'array',
      fields: [
        {
          name: 'id',
          type: 'text',
          required: true,
        },
        {
          name: 'title',
          type: 'text',
          required: true,
        },
        {
          name: 'description',
          type: 'text',
        },
        {
          name: 'questions',
          type: 'array',
          fields: [
            {
              name: 'question_id',
              type: 'text',
              required: true,
              label: 'Question ID (e.g. F0_EMAIL)',
            },
            {
              name: 'question_text',
              type: 'text',
              required: true,
            },
            {
              name: 'question_type',
              type: 'select',
              options: [
                { label: 'Short Text', value: 'short_text' },
                { label: 'Long Text', value: 'long_text' },
                { label: 'Email', value: 'email' },
                { label: 'URL', value: 'url' },
                { label: 'Number', value: 'number' },
                { label: 'Dropdown', value: 'dropdown' },
                { label: 'Multiple Choice (Single)', value: 'multiple_choice_single' },
                { label: 'Multiple Choice (Multiple)', value: 'multiple_choice_multiple' },
                { label: 'Yes/No', value: 'yes_no' },
                { label: 'Range / Slider', value: 'range' },
                { label: 'Statement (read-only)', value: 'statement' },
                { label: 'File Upload', value: 'file_upload' },
              ],
              required: true,
            },
            {
              name: 'required',
              type: 'checkbox',
              defaultValue: false,
            },
            {
              name: 'choices',
              type: 'array',
              label: 'Choices (for dropdown/multiple choice)',
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'value',
                  type: 'text',
                  required: true,
                },
              ],
            },
            {
              name: 'numberMinType',
              type: 'select',
              label: 'Minimum Value',
              options: [
                { label: '-∞ (No minimum)', value: 'none' },
                { label: 'Custom value', value: 'custom' },
              ],
              defaultValue: 'none',
              admin: {
                condition: (_, siblingData) => siblingData?.question_type === 'number',
              },
            },
            {
              name: 'numberMinValue',
              type: 'number',
              label: 'Min Value',
              admin: {
                condition: (_, siblingData) =>
                  siblingData?.question_type === 'number' && siblingData?.numberMinType === 'custom',
              },
            },
            {
              name: 'numberMaxType',
              type: 'select',
              label: 'Maximum Value',
              options: [
                { label: '+∞ (No maximum)', value: 'none' },
                { label: 'Custom value', value: 'custom' },
              ],
              defaultValue: 'none',
              admin: {
                condition: (_, siblingData) => siblingData?.question_type === 'number',
              },
            },
            {
              name: 'numberMaxValue',
              type: 'number',
              label: 'Max Value',
              admin: {
                condition: (_, siblingData) =>
                  siblingData?.question_type === 'number' && siblingData?.numberMaxType === 'custom',
              },
            },
            {
              name: 'fileUploadAccept',
              type: 'text',
              label: 'Accepted file types',
              admin: {
                condition: (_, siblingData) => siblingData?.question_type === 'file_upload',
                description: 'Comma-separated MIME types or extensions, e.g. audio/*,video/*,image/*,.pdf',
              },
            },
            {
              name: 'placeholder',
              type: 'text',
            },
            {
              name: 'helperText',
              type: 'text',
            },
            {
              name: 'exampleHintTitle',
              type: 'text',
              label: 'Example Hint Title',
              admin: {
                description: 'Optional title for the example-answer bubble shown beside the question label.',
              },
            },
            {
              name: 'exampleHintBody',
              type: 'textarea',
              label: 'Example Hint Body',
              admin: {
                description: 'Optional fictional example answer, e.g. a Cleanopatra sample response.',
              },
            },
          ],
        },
      ],
    },
  ],
}
