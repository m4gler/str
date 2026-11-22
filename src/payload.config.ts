import { buildConfig } from 'payload'
import type { EmailAdapter } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { resendAdapter } from '@payloadcms/email-resend'

import { Users } from './collections/Users.ts'
import { Media } from './collections/Media.ts'
import { Documents } from './collections/Documents.ts'
import { InvestorForms } from './collections/InvestorForms.ts'
import { InvestorFormSubmissions } from './collections/InvestorFormSubmissions.ts'
import { FounderForms } from './collections/FounderForms.ts'
import { FounderFormSubmissions } from './collections/FounderFormSubmissions.ts'
import { Partners } from './collections/Partners.ts'
import { PartnerInviteLinks } from './collections/PartnerInviteLinks.ts'
import { TrackInviteLinks } from './collections/TrackInviteLinks.ts'
import { ArchetypeDaySchedules } from './collections/ArchetypeDaySchedules.ts'
import { UserDayOverrides } from './collections/UserDayOverrides.ts'
import { DiscountCodes } from './collections/DiscountCodes.ts'
import { ProjectSubmissions } from './collections/ProjectSubmissions.ts'
import { Tracks } from './collections/Tracks.ts'
import { TrackDaySchedules } from './collections/TrackDaySchedules.ts'
import { PartnerDaySchedules } from './collections/PartnerDaySchedules.ts'
import { DayDefinitions } from './collections/DayDefinitions.ts'
import { Cohorts } from './collections/Cohorts.ts'
import { Attempts } from './collections/Attempts.ts'
import { AutoCheckResults } from './collections/AutoCheckResults.ts'
import { EcosystemItems } from './collections/EcosystemItems.ts'
import { IntroRequests } from './collections/IntroRequests.ts'
import { MentorReviews } from './collections/MentorReviews.ts'
import { Mentors } from './collections/Mentors.ts'
import { Teams } from './collections/Teams.ts'
import { FormDrafts } from './collections/FormDrafts.ts'
import { NewsPosts } from './collections/NewsPosts.ts'
import { StatisticsEmailTemplates } from './collections/StatisticsEmailTemplates.ts'
import { createPostgresPoolConfig } from './lib/postgresConfig.ts'

import { PlatformSettings } from './globals/PlatformSettings.ts'
import { DayProgram } from './globals/DayProgram.ts'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const resendApiKey = process.env.RESEND_API_KEY?.trim()
const disableEmailDelivery =
  process.env.DISABLE_EMAIL_DELIVERY === 'true' ||
  process.env.NODE_ENV === 'test'

const noopEmailAdapter: EmailAdapter = () => ({
  name: 'noop-email',
  defaultFromAddress: 'notifications@email.bakery.vc',
  defaultFromName: 'MESGA Platform',
  sendEmail: async () => ({ skipped: true }),
})

if (!disableEmailDelivery && !resendApiKey) {
  console.warn('[payload.config] RESEND_API_KEY is not set. Email delivery is disabled.')
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: '- MESGA Platform Admin',
    },
    components: {
      views: {
        stringFinder: {
          Component: './components/admin/StringFinder#default',
          path: '/search',
        },
        founderProgress: {
          Component: './components/admin/FounderProgressView#default',
          path: '/founder-progress',
        },
        statistics: {
          Component: './components/admin/StatisticsView#default',
          path: '/statistics',
        },
        trackInvites: {
          Component: './components/admin/TrackInvitesView#default',
          path: '/track-invites',
        },
        certificates: {
          Component: './components/admin/CertificatesView#default',
          path: '/certificates',
        },
      },
      afterNavLinks: [
        './components/admin/StringFinderNavLink#default',
        './components/admin/FounderProgressNavLink#default',
        './components/admin/StatisticsNavLink#default',
        './components/admin/TrackInvitesNavLink#default',
        './components/admin/CertificatesNavLink#default',
      ],
    },
  },
  collections: [Users, Media, Documents, InvestorForms, InvestorFormSubmissions, FounderForms, FounderFormSubmissions, Partners, PartnerInviteLinks, TrackInviteLinks, ArchetypeDaySchedules, UserDayOverrides, DiscountCodes, ProjectSubmissions, Tracks, TrackDaySchedules, PartnerDaySchedules, DayDefinitions, Cohorts, Attempts, AutoCheckResults, EcosystemItems, IntroRequests, MentorReviews, Mentors, Teams, FormDrafts, NewsPosts, StatisticsEmailTemplates],

  globals: [PlatformSettings, DayProgram],
  email: disableEmailDelivery || !resendApiKey
    ? noopEmailAdapter
    : resendAdapter({
        defaultFromAddress: 'notifications@email.bakery.vc',
        defaultFromName: 'MESGA Platform',
        apiKey: resendApiKey,
      }),
  editor: lexicalEditor({}),
  secret: (() => {
    const s = process.env.PAYLOAD_SECRET
    if (!s) throw new Error('PAYLOAD_SECRET environment variable is required')
    return s
  })(),
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      ...createPostgresPoolConfig(undefined, {
        max: 5,
        idleTimeoutMillis: 20000,
        connectionTimeoutMillis: 30000,
      }),
    },
  }),
  sharp,
  plugins: [
    vercelBlobStorage({
      enabled: true,
      addRandomSuffix: true,
      collections: {
        media: true,
        documents: true,
      },
      token: process.env.BLOB_READ_WRITE_TOKEN || '',
    }),
  ],
})
