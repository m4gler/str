import type { CollectionConfig } from 'payload'

export const ArchetypeDaySchedules: CollectionConfig = {
  slug: 'archetype-day-schedules',
  trash: true,
  admin: {
    useAsTitle: 'archetype',
    group: '📅 Day Program',
    components: {
      views: {
        edit: {
          default: {
            Component: '@/components/Payload/DayProgramEditor#default',
          },
        },
      },
    },
  },
  access: {
    read: ({ req: { user } }) => user?.role === 'admin',
    create: ({ req: { user } }) => user?.role === 'admin',
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'archetype',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Archetype key (must match the key in PlatformSettings → Personality Engine). Each archetype can have exactly one schedule document.',
      },
    },
    {
      name: 'schedule',
      type: 'json',
      label: '100-Day Schedule',
      admin: {
        description: 'Managed via the visual editor above. Format: { "1": formId, "2": formId, ... }',
      },
    },
    {
      name: 'preworkSchedule',
      type: 'json',
      label: 'Prework Schedule',
      admin: {
        description: 'Managed via the visual editor. Format: { "1": formId, "2": formId, ... } for PW01–PW10.',
      },
    },
  ],
}
