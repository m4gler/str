import type { CollectionConfig } from 'payload'

function createDownloadToken(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, '')
}

export const Documents: CollectionConfig = {
  slug: 'documents',
  trash: true,
  admin: {
    useAsTitle: 'title',
    description: 'Upload and manage documents (PDFs, presentations, word docs, etc.)',
    group: '📄 Documents',
  },
  access: {
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') {
        return true
      }

      if (user?.role === 'mentor') {
        const partnerId = (user as any).partner?.id ?? (user as any).partner
        if (!partnerId) {
          return true
        }

        return {
          or: [
            { visibility: { equals: 'public' } },
            { owner: { equals: user.id } },
            {
              and: [
                { visibility: { equals: 'private' } },
                { 'owner.partner': { equals: partnerId } },
              ],
            },
          ],
        } as any
      }

      if (user?.role === 'partner') {
        const partnerId = (user as any).partner?.id ?? (user as any).partner
        if (!partnerId) {
          return { owner: { equals: user.id } } as any
        }

        return {
          or: [
            { visibility: { equals: 'public' } },
            { owner: { equals: user.id } },
            {
              and: [
                { visibility: { equals: 'private' } },
                { 'owner.partner': { equals: partnerId } },
              ],
            },
          ],
        } as any
      }

      return {
        or: [
          { visibility: { equals: 'public' } },
          ...(user ? [{ owner: { equals: user.id } }] : []),
        ],
      } as any
    },
    create: ({ req: { user } }) => user?.role === 'admin',
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        const downloadToken = data?.downloadToken || originalDoc?.downloadToken || createDownloadToken()

        return {
          ...data,
          downloadToken,
        }
      },
    ],
  },
  upload: {
    mimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ],
  },
  fields: [
    {
      name: 'visibility',
      type: 'select',
      required: true,
      defaultValue: 'public',
      options: [
        { label: 'Public', value: 'public' },
        { label: 'Private', value: 'private' },
      ],
      admin: {
        description: 'Public documents may be downloaded without authentication. Private documents require an authorized session.',
      },
    },
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        readOnly: true,
        description: 'Owner of a private user-uploaded document.',
      },
    },
    {
      name: 'downloadToken',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        hidden: true,
        readOnly: true,
        description: 'Opaque token used in download URLs to avoid enumerable document IDs.',
      },
    },
    {
      name: 'title',
      label: 'Document Title',
      type: 'text',
      required: true,
      admin: {
        description: 'A descriptive title for this document. Example: "Privacy Policy Bakery VC"',
      },
    },
  ],
}
