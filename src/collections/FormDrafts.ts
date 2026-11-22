import type { CollectionConfig } from 'payload'

export const FormDrafts: CollectionConfig = {
    slug: 'form-drafts',
    admin: {
        useAsTitle: 'formSlug',
        group: 'User Forms',
        defaultColumns: ['user', 'formSlug', 'formType', 'lastSavedAt'],
        description: 'Auto-saved in-progress form state. Deleted on successful final submission.',
    },
    access: {
        create: ({ req: { user } }) => Boolean(user),
        read: ({ req: { user } }) => {
            if (!user) return false
            if (user.role === 'admin') return true
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
    hooks: {
        beforeValidate: [
            ({ data }) => {
                const userId = typeof data?.user === 'object' ? data.user?.id : data?.user
                const formSlug = typeof data?.formSlug === 'string' ? data.formSlug.trim() : ''

                return {
                    ...data,
                    draftKey: userId && formSlug ? `${userId}:${formSlug}` : data?.draftKey,
                }
            },
        ],
        beforeChange: [
            ({ data }) => {
                return { ...data, lastSavedAt: new Date().toISOString() }
            },
        ],
    },
    fields: [
        {
            name: 'user',
            type: 'relationship',
            relationTo: 'users',
            required: true,
            index: true,
            admin: { readOnly: true },
        },
        {
            name: 'formSlug',
            type: 'text',
            required: true,
            index: true,
            admin: {
                description: 'Identifier of the form being drafted (e.g. "founder-intake-v1", "personality_test", "daily-day-block-1", "project-submission", "investor-intake-v1").',
            },
        },
        {
            name: 'draftKey',
            type: 'text',
            unique: true,
            index: true,
            admin: {
                readOnly: true,
                hidden: true,
            },
        },
        {
            name: 'formType',
            type: 'select',
            required: true,
            options: [
                { label: 'Founder Intake', value: 'founder_intake' },
                { label: 'Personality Test', value: 'personality' },
                { label: 'Daily', value: 'daily' },
                { label: 'Weekly Retro', value: 'weekly' },
                { label: 'Gate', value: 'gate' },
                { label: 'Prework', value: 'prework' },
                { label: 'Investor Intake', value: 'investor' },
                { label: 'Project Submission', value: 'project_submission' },
            ],
        },
        {
            name: 'answers',
            type: 'json',
            required: false,
            admin: {
                description: 'Partial form state snapshot.',
            },
        },
        {
            name: 'lastSavedAt',
            type: 'date',
            admin: {
                readOnly: true,
                date: { pickerAppearance: 'dayAndTime' },
            },
        },
    ],
}
