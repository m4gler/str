import type { CollectionConfig } from 'payload'

export const Partners: CollectionConfig = {
    slug: 'partners',
    trash: true,
    admin: {
        useAsTitle: 'name',
        group: 'Platform',
    },
    access: {
        create: ({ req: { user } }) => user?.role === 'admin',
        read: ({ req: { user } }) => {
            if (!user) return false
            if (user.role === 'admin') return true
            if (user.role === 'partner' || user.role === 'mentor') {
                const partnerId = (user as any).partner?.id ?? (user as any).partner
                if (partnerId) return { id: { equals: partnerId } }
            }
            // Founders/investors: only see their own partner
            const ownPartnerId = (user as any).partner?.id ?? (user as any).partner
            if (ownPartnerId) return { id: { equals: ownPartnerId } }
            return false
        },
        update: ({ req: { user } }) => {
            if (!user) return false
            if (user.role === 'admin') return true
            // Partners can update their own record (e.g. banned words)
            if (user.role === 'partner') {
                const partnerId = (user as any).partner?.id ?? (user as any).partner
                if (!partnerId) return false
                return { id: { equals: partnerId } }
            }
            return false
        },
        delete: ({ req: { user } }) => user?.role === 'admin',
    },
    fields: [
        {
            name: 'name',
            type: 'text',
            required: true,
        },
        {
            name: 'slug',
            type: 'text',
            required: true,
            unique: true,
            index: true,
            admin: {
                description: 'Used in the invite URL: /invite/[slug]',
            },
        },
        {
            name: 'description',
            type: 'textarea',
        },
        {
            name: 'tracks',
            type: 'relationship',
            relationTo: 'tracks',
            hasMany: true,
            label: 'Allowed Tracks',
            admin: {
                description: 'Tracks this partner can use when generating private referral links.',
            },
        },
        {
            name: 'isActive',
            type: 'checkbox',
            defaultValue: true,
            admin: {
                description: 'Only active partners appear in the dropdown on intake forms',
            },
        },
        {
            name: 'showOnLanding',
            type: 'checkbox',
            label: 'Show on Landing Page',
            defaultValue: true,
            admin: {
                description: 'Controls whether this partner appears in the public landing-page partners section.',
            },
        },
        {
            name: 'landingOrder',
            type: 'number',
            label: 'Landing Sort Order',
            defaultValue: 0,
            admin: {
                description: 'Lower numbers appear first in the landing-page partners section.',
            },
        },
        {
            name: 'websiteUrl',
            type: 'text',
            label: 'Website URL',
            admin: {
                description: 'Public website opened when a visitor clicks the partner logo on the landing page.',
                placeholder: 'https://example.com',
            },
        },
        {
            name: 'customPricing',
            type: 'group',
            label: 'Custom Pricing',
            admin: {
                description: 'Override the default payment amount for users linked to this partner.',
            },
            fields: [
                {
                    name: 'enabled',
                    type: 'checkbox',
                    defaultValue: false,
                    label: 'Enable custom pricing for this partner',
                },
                {
                    name: 'type',
                    type: 'select',
                    defaultValue: 'free',
                    options: [
                        { label: 'Free (no payment required)', value: 'free' },
                        { label: 'Fixed price (custom amount)', value: 'fixed' },
                    ],
                    admin: {
                        condition: (_data, siblingData) => Boolean(siblingData?.enabled),
                    },
                },
                {
                    name: 'amountGroszy',
                    type: 'number',
                    label: 'Amount (grosze)',
                    admin: {
                        description: 'Price in Polish grosze. 1 PLN = 100 grosze. E.g. 49900 = 499.00 PLN.',
                        condition: (_data, siblingData) => siblingData?.enabled && siblingData?.type === 'fixed',
                    },
                },
            ],
        },
        {
            name: 'logo',
            type: 'upload',
            relationTo: 'media',
            label: 'Partner Logo',
            admin: {
                description: 'Logo shown on the dashboard for users referred by this partner.',
            },
        },
        {
            name: 'bannedWords',
            type: 'textarea',
            label: 'Banned Words',
            admin: {
                description: 'Words that automatically deny a project submission. Separate with commas, spaces, newlines, or dashes. Only exact whole-word matches are detected.',
            },
        },
        {
            name: 'brandingColors',
            type: 'json',
            label: 'Branding Colors',
            admin: {
                description: 'Per-phase color overrides for the 100 Days Program UI (mix, proof, bake, glaze). Each phase supports solid or gradient. Managed via the Partner Dashboard UI.',
            },
        },
        {
            name: 'overrideGrantsRemaining',
            type: 'number',
            label: 'Override Grants Remaining',
            defaultValue: 0,
            min: 0,
            access: {
                update: ({ req: { user } }) => user?.role === 'admin',
            },
            admin: {
                description: 'How many additional attempt grants this partner can still issue. Decremented when partner grants an extra attempt. Only admin can increase this.',
            },
        },
        {
            name: 'location',
            type: 'group',
            label: 'Location',
            admin: {
                description: 'Partner location for ecosystem mapping.',
            },
            fields: [
                {
                    name: 'city',
                    type: 'text',
                    label: 'City',
                },
                {
                    name: 'country',
                    type: 'text',
                    label: 'Country',
                },
                {
                    name: 'lat',
                    type: 'number',
                    label: 'Latitude',
                    admin: {
                        step: 0.000001,
                        description: 'Decimal degrees (e.g. 52.2297)',
                    },
                },
                {
                    name: 'lng',
                    type: 'number',
                    label: 'Longitude',
                    admin: {
                        step: 0.000001,
                        description: 'Decimal degrees (e.g. 21.0122)',
                    },
                },
            ],
        },
    ],
}
