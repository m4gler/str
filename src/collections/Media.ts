import type { CollectionConfig } from 'payload'
import path from 'path'

export const Media: CollectionConfig = {
  slug: 'media',
  trash: true,
  admin: {
    useAsTitle: 'alt',
    description: 'Upload and manage images used across the website.',
    group: '🖼️ Media',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  upload: {
    staticDir: path.resolve(process.cwd(), 'public/media'),
    imageSizes: [
      {
        name: 'thumbnail',
        width: 400,
        height: undefined,
        position: 'centre',
      },
      {
        name: 'card',
        width: 768,
        height: undefined,
        position: 'centre',
      },
      {
        name: 'hero',
        width: 1920,
        height: undefined,
        position: 'centre',
      },
    ],
    adminThumbnail: 'thumbnail',
    mimeTypes: ['image/*'],
  },
  fields: [
    {
      name: 'alt',
      label: 'Alt Text (Description)',
      type: 'text',
      required: true,
      admin: {
        description: 'Describe the image for accessibility. Example: "Team meeting in office"',
      },
    },
  ],
}
