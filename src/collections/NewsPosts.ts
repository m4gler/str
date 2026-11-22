import type { Block, CollectionConfig } from 'payload'

const ParagraphBlock: Block = {
  slug: 'paragraph',
  labels: {
    singular: 'Paragraph',
    plural: 'Paragraphs',
  },
  fields: [
    {
      name: 'body',
      type: 'textarea',
      required: true,
    },
  ],
}

const CtaBlock: Block = {
  slug: 'cta',
  labels: {
    singular: 'CTA',
    plural: 'CTAs',
  },
  fields: [
    { name: 'label', type: 'text' },
    { name: 'headline', type: 'text', required: true },
    { name: 'sub', type: 'textarea' },
    { name: 'href', type: 'text', required: true },
    { name: 'buttonLabel', type: 'text', defaultValue: 'Apply' },
    { name: 'note', type: 'text' },
  ],
}

const OfferGridBlock: Block = {
  slug: 'offerGrid',
  labels: {
    singular: 'Offer Grid',
    plural: 'Offer Grids',
  },
  fields: [
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        {
          name: 'icon',
          type: 'select',
          required: true,
          defaultValue: 'target',
          options: [
            { label: 'Rocket', value: 'rocket' },
            { label: 'Globe', value: 'globe' },
            { label: 'Target', value: 'target' },
            { label: 'Briefcase', value: 'briefcase' },
          ],
        },
        { name: 'title', type: 'text', required: true },
        { name: 'desc', type: 'textarea', required: true },
      ],
    },
  ],
}

const PullQuoteBlock: Block = {
  slug: 'pullQuote',
  labels: {
    singular: 'Pull Quote',
    plural: 'Pull Quotes',
  },
  fields: [
    { name: 'quote', type: 'textarea', required: true },
    { name: 'cite', type: 'text' },
  ],
}

export const NewsPosts: CollectionConfig = {
  slug: 'news-posts',
  labels: {
    singular: 'News Post',
    plural: 'News Posts',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'publishedAt', 'updatedAt'],
  },
  access: {
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      return {
        status: {
          equals: 'published',
        },
      }
    },
    create: ({ req: { user } }) => user?.role === 'admin',
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
    },
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
      name: 'excerpt',
      type: 'textarea',
      required: true,
    },
    {
      name: 'category',
      type: 'text',
      defaultValue: 'Accelerator - Special Offer',
    },
    {
      name: 'publishedAt',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'readTime',
      type: 'text',
      defaultValue: '5 min read',
    },
    {
      name: 'urgencyText',
      type: 'textarea',
      admin: {
        description: 'Optional gold notice shown above the article.',
      },
    },
    {
      name: 'heroBadge',
      type: 'group',
      fields: [
        { name: 'label', type: 'text', defaultValue: 'Limited - May 2026 Only' },
        { name: 'main', type: 'text', defaultValue: 'FREE ACCESS TO MESGA' },
        { name: 'sub', type: 'textarea' },
      ],
    },
    {
      name: 'author',
      type: 'group',
      fields: [
        { name: 'name', type: 'text', defaultValue: 'Piotr Boulange' },
        { name: 'role', type: 'text', defaultValue: 'Founding Partner, Bakery Ventures' },
        { name: 'initials', type: 'text', defaultValue: 'PB' },
      ],
    },
    {
      name: 'content',
      type: 'blocks',
      required: true,
      blocks: [ParagraphBlock, CtaBlock, OfferGridBlock, PullQuoteBlock],
    },
  ],
}
