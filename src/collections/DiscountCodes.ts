import type { CollectionConfig } from 'payload'

export const DiscountCodes: CollectionConfig = {
    slug: 'discount-codes',
    trash: true,
    admin: {
        useAsTitle: 'code',
        group: '💰 Payments',
        defaultColumns: ['code', 'type', 'value', 'isActive', 'useCount', 'maxUses', 'expiresAt', 'label'],
        components: {
            beforeList: ['./components/Payload/CodeGenerator#default'],
        },
    },
    access: {
        create: ({ req: { user } }) => user?.role === 'admin',
        read: ({ req: { user } }) => user?.role === 'admin',
        update: ({ req: { user } }) => user?.role === 'admin',
        delete: ({ req: { user } }) => user?.role === 'admin',
    },
    fields: [
        {
            name: 'code',
            type: 'text',
            required: true,
            unique: true,
            index: true,
            admin: {
                description: 'Unique discount code (auto-generated or custom). Always stored uppercase.',
            },
        },
        {
            name: 'type',
            type: 'select',
            required: true,
            options: [
                { label: 'Percentage off (%)', value: 'percent' },
                { label: 'Fixed amount off (PLN)', value: 'fixed_amount' },
            ],
        },
        {
            name: 'value',
            type: 'number',
            required: true,
            admin: {
                description: 'For percent: 0–100 (e.g. 20 = 20% off). For fixed amount: PLN value (e.g. 100 = 100 PLN off).',
            },
        },
        {
            name: 'label',
            type: 'text',
            label: 'Internal Label',
            admin: {
                description: 'Optional admin note (e.g. "Partner X · March 2025 batch").',
            },
        },
        {
            name: 'isActive',
            type: 'checkbox',
            defaultValue: true,
            label: 'Active',
        },
        {
            name: 'maxUses',
            type: 'number',
            defaultValue: 1,
            label: 'Max Uses',
            admin: {
                description: 'How many times this code can be used in total. 0 = unlimited.',
            },
        },
        {
            name: 'useCount',
            type: 'number',
            defaultValue: 0,
            label: 'Times Used',
            admin: {
                readOnly: true,
                description: 'Updated automatically each time the code is redeemed.',
            },
        },
        {
            name: 'usedBy',
            type: 'relationship',
            relationTo: 'users',
            hasMany: true,
            label: 'Used By',
            admin: {
                readOnly: true,
                description: 'Users who have redeemed this code.',
            },
        },
        {
            name: 'pendingUsers',
            type: 'relationship',
            relationTo: 'users',
            hasMany: true,
            label: 'Pending Users',
            admin: {
                readOnly: true,
                description: 'Users with an in-progress payment currently reserving this code.',
            },
        },
        {
            name: 'expiresAt',
            type: 'date',
            label: 'Expires At',
            admin: {
                date: { pickerAppearance: 'dayOnly' },
                description: 'Leave blank for no expiry.',
            },
        },
        {
            name: 'restrictToUser',
            type: 'relationship',
            relationTo: 'users',
            label: 'Restrict to Specific User',
            admin: {
                description: 'If set, only this user can redeem the code. Leave blank for anyone.',
            },
        },
    ],
}
