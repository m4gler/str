import type { CollectionConfig } from 'payload'
import { after } from 'next/server'
import {
  generateResetPasswordEmailHTML,
  generateVerificationEmailHTML,
  generateVerificationEmailSubject,
  isPublicSignupRole,
  shouldAutoVerifyLoginUser,
} from '@/lib/accountVerification'
import { getAppUrl } from '@/lib/appUrl'
import { buildDashboardCalendarNoticeData, getRelationId } from '@/lib/dashboardCalendarNotice'
import { buildFounderProgramStatusAlertEvent, queueFounderStatusAlert } from '@/lib/founderStatusAlerts'
import { notifyUserRegistrationAlert } from '@/lib/notifications'
import { TEST_PROGRAM_STATUS } from '@/lib/programTestMode'

function scheduleBackgroundTask(task: () => Promise<void>): void {
  try {
    after(task)
  } catch (error) {
    if (error instanceof Error && error.message.includes('outside a request scope')) {
      void Promise.resolve().then(task)
      return
    }
    throw error
  }
}

export const Users: CollectionConfig = {
  slug: 'users',
  trash: true,
  admin: {
    useAsTitle: 'email',
    group: '👥 Users',
    components: {
      views: {
        edit: {
          default: {
            Component: '@/components/Payload/UserEditor#default',
          },
        },
      },
    },
  },
  hooks: {
    beforeOperation: [
      async ({ args, operation, req }) => {
        if (operation !== 'login') {
          return args
        }

        const email = typeof args?.data?.email === 'string'
          ? args.data.email.trim().toLowerCase()
          : ''

        if (!email) {
          return args
        }

        const existingUsers = await req.payload.find({
          collection: 'users',
          where: {
            email: {
              equals: email,
            },
          },
          limit: 1,
          overrideAccess: true,
          showHiddenFields: true,
          depth: 0,
        })

        const existingUser = existingUsers.docs[0] as any

        if (!shouldAutoVerifyLoginUser(existingUser)) {
          return args
        }

        await req.payload.update({
          collection: 'users',
          id: existingUser.id,
          data: {
            _verified: true,
            _verificationToken: null,
            verificationEmailLastSentAt: null,
          } as any,
          overrideAccess: true,
          showHiddenFields: true,
        })

        return args
      },
    ],
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        const callerRole = req.user?.role
        const requestedRole = data.role
        const trustedVerificationBypass = req.context?.trustedVerificationBypass === true

        if (typeof data.email === 'string') {
          data.email = data.email.trim().toLowerCase()
        }

        // Anonymous creates must never be able to assign privileged roles.
        if (!callerRole) {
          if (operation === 'create' && ['admin', 'partner', 'mentor'].includes(data.role)) {
            data.role = 'founder'
          }

          if (operation === 'create' && isPublicSignupRole(requestedRole) && !trustedVerificationBypass) {
            data._verified = false
            data.verificationEmailLastSentAt = new Date().toISOString()
          }

          return data
        }
        // Prevent non-admins from self-promoting to admin or partner role
        if (data.role === 'admin' && callerRole !== 'admin') {
          data.role = operation === 'create' ? 'founder' : undefined
        }
        if (data.role === 'partner' && callerRole !== 'admin') {
          data.role = operation === 'create' ? 'founder' : undefined
        }
        // Partners can create mentors (scoped to their org via server action); admins can too
        if (data.role === 'mentor' && callerRole !== 'admin' && callerRole !== 'partner') {
          data.role = operation === 'create' ? 'founder' : undefined
        }

        if (operation === 'create') {
          data._verified = true
          data._verificationToken = null
          data.verificationEmailLastSentAt = null
        }

        if (
          operation === 'update' &&
          req.context?.skipDashboardCalendarNoticeSync !== true &&
          callerRole === 'admin' &&
          (data.role ?? originalDoc?.role) === 'founder' &&
          originalDoc?.id
        ) {
          const previousPartnerId = getRelationId(originalDoc?.partner)
          const nextPartnerId = getRelationId(data.partner !== undefined ? data.partner : originalDoc?.partner)

          if (String(previousPartnerId ?? '') !== String(nextPartnerId ?? '')) {
            data.dashboardCalendarNotice = await buildDashboardCalendarNoticeData(req.payload, {
              userId: originalDoc.id,
              existingNotice: (originalDoc as any)?.dashboardCalendarNotice ?? null,
              previousPartnerId,
              nextPartnerId,
              currentPartnerId: nextPartnerId,
            })
          }
        }

        return data
      },
    ],
    afterChange: [
      async ({ doc, operation, previousDoc, req }) => {
        if (operation !== 'update') return doc
        if (req.context?.skipFounderStatusAlert === true) return doc
        if (doc.role !== 'founder') return doc

        const event = buildFounderProgramStatusAlertEvent(
          previousDoc?.programStatus,
          doc.programStatus,
        )

        if (!event) return doc

        scheduleBackgroundTask(async () => {
          try {
            await queueFounderStatusAlert(req.payload, doc.id, event, getAppUrl())
          } catch (err) {
            console.warn('[Users] Failed to send founder status alert', doc.id, err)
          }
        })

        return doc
      },
      async ({ doc, operation, req }) => {
        if (operation !== 'create') return doc
        if (req.context?.skipRegistrationAlert === true) return doc
        if (req.user) return doc
        if (!isPublicSignupRole(doc.role)) return doc
        if (!doc.email) return doc

        const sendRegistrationAlert = async () => {
          try {
            await notifyUserRegistrationAlert(
              req.payload,
              {
                userId: doc.id,
                email: doc.email,
                role: doc.role,
                authMethod: doc.googleId ? 'Google' : 'Email + password',
                isVerified: (doc as any)._verified === true,
              },
              getAppUrl(),
            )
          } catch (err) {
            console.warn('[Users] Failed to send registration alert', doc.id, err)
          }
        }

        scheduleBackgroundTask(sendRegistrationAlert)
        return doc
      },
    ],
  },
  auth: {
    tokenExpiration: 60 * 60 * 24 * 30, // 30 days
    verify: {
      generateEmailHTML: ({ token, user }) => generateVerificationEmailHTML({ token, user: user as any }),
      generateEmailSubject: () => generateVerificationEmailSubject(),
    },
    forgotPassword: {
      generateEmailHTML: (args) => {
        const { token, user } = args || {}
        if (!token || !user) return ''

        return generateResetPasswordEmailHTML({ token, user: user as any })
      },
    },
  },
  access: {
    create: () => true,
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return {
        id: {
          equals: user.id,
        },
      }
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return {
        id: {
          equals: user.id,
        },
      }
    },
    delete: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return {
        id: {
          equals: user.id,
        },
      }
    },
    admin: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Founder', value: 'founder' },
        { label: 'Investor', value: 'investor' },
        { label: 'Partner', value: 'partner' },
        { label: 'Mentor', value: 'mentor' },
      ],
      defaultValue: 'founder',
      required: true,
      saveToJWT: true,
    },
    {
      name: 'businessIdea',
      type: 'textarea',
      label: 'Business Idea / Concept',
      access: {
        read: ({ req: { user }, id }) => {
          if (!user) return false
          if (user.role === 'admin') return true
          return String(user.id) === String(id)
        },
        update: ({ req: { user }, id }) => {
          if (!user) return false
          if (user.role === 'admin') return true
          return String(user.id) === String(id)
        },
      },
    },
    {
      name: 'phoneNumber',
      type: 'text',
      label: 'Phone Number',
    },
    {
      name: 'npsMentors',
      type: 'number',
      label: 'NPS — Mentors',
      min: 0,
      max: 10,
      admin: { description: 'NPS rating for mentors (0–10).' },
    },
    {
      name: 'npsTasks',
      type: 'number',
      label: 'NPS — Daily Tasks',
      min: 0,
      max: 10,
      admin: { description: 'NPS rating for daily tasks (0–10).' },
    },
    {
      name: 'npsBlocks',
      type: 'number',
      label: 'NPS — Program Blocks',
      min: 0,
      max: 10,
      admin: { description: 'NPS rating for program blocks (0–10).' },
    },
    {
      name: 'googleId',
      type: 'text',
      admin: {
        readOnly: true,
        condition: (data) => Boolean(data?.googleId),
      },
      access: {
        read: ({ req: { user } }) => user?.role === 'admin',
        update: ({ req: { user } }) => user?.role === 'admin',
      },
    },
    {
      name: 'isOnboarded',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'verificationEmailLastSentAt',
      type: 'date',
      hidden: true,
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
      },
      access: {
        read: ({ req: { user } }) => user?.role === 'admin',
        update: ({ req: { user } }) => user?.role === 'admin',
      },
    },
    {
      name: 'hasPaid100Days',
      type: 'checkbox',
      label: '100 Days — Payment Confirmed',
      defaultValue: false,
      access: {
        update: ({ req: { user } }) => user?.role === 'admin',
        create: ({ req: { user } }) => user?.role === 'admin',
      },
    },
    {
      name: 'founderChatInviteSentAt',
      type: 'date',
      label: 'Founder Chat Invite Sent At',
      admin: {
        readOnly: true,
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Set automatically when the founder chat invite email is sent.',
      },
      access: {
        update: ({ req: { user } }) => user?.role === 'admin',
        create: ({ req: { user } }) => user?.role === 'admin',
      },
    },
    {
      name: 'founderStatusAlertHistory',
      type: 'array',
      label: 'Founder Status Alert History',
      admin: {
        condition: () => false,
        description: 'Internal dedupe log for operational founder status-change alerts.',
      },
      access: {
        read: ({ req: { user } }) => user?.role === 'admin',
        update: ({ req: { user } }) => user?.role === 'admin',
        create: ({ req: { user } }) => user?.role === 'admin',
      },
      fields: [
        { name: 'eventKey', type: 'text', required: true },
        { name: 'eventLabel', type: 'text' },
        { name: 'sentAt', type: 'date', required: true },
      ],
    },
    {
      name: 'programStatus',
      type: 'select',
      label: '100 Days — Program Status',
      options: [
        { label: 'Not Started', value: 'not_started' },
        { label: 'Prework', value: 'prework' },
        { label: 'Active', value: 'active' },
        { label: 'Test Mode (All Days Unlocked)', value: TEST_PROGRAM_STATUS },
        { label: 'Failed (Inactive)', value: 'failed' },
        { label: 'Frozen', value: 'frozen' },
        { label: 'Completed', value: 'completed' },
      ],
      defaultValue: 'not_started',
      saveToJWT: true,
      admin: {
        description: 'Internal QA-only mode. Unlocks the full 100-day calendar and bypasses day/form gating for this user.',
      },
      access: {
        update: ({ req: { user } }) => user?.role === 'admin',
        create: ({ req: { user } }) => user?.role === 'admin',
      },
    },
    {
      name: 'programStartDate',
      type: 'date',
      label: '100 Days — Current Attempt Start Date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Set automatically when a program attempt begins.',
      },
      access: {
        update: ({ req: { user } }) => user?.role === 'admin',
        create: ({ req: { user } }) => user?.role === 'admin',
      },
    },
    {
      name: 'programAttempts',
      type: 'number',
      label: '100 Days — Attempts Used',
      defaultValue: 0,
      admin: {
        description: 'Number of times the user has started the 100-day program. Max depends on payment type (configured in DayProgram global).',
      },
      access: {
        update: ({ req: { user } }) => user?.role === 'admin',
        create: ({ req: { user } }) => user?.role === 'admin',
      },
    },
    {
      name: 'partner',
      type: 'relationship',
      relationTo: 'partners',
      label: 'Partner',
      admin: {
        description: 'Partner associated with this user. Determines custom pricing if partner has it enabled.',
      },
      access: {
        update: ({ req: { user } }) => user?.role === 'admin',
        create: ({ req: { user } }) => user?.role === 'admin',
      },
    },
    {
      name: 'mentor',
      type: 'relationship',
      relationTo: 'mentors',
      label: 'Assigned Mentor',
      admin: {
        description: 'Mentor assigned to this user and shown on the user account dashboard.',
      },
      access: {
        update: ({ req: { user } }) => user?.role === 'admin',
        create: ({ req: { user } }) => user?.role === 'admin',
      },
    },
    {
      name: 'team',
      type: 'relationship',
      relationTo: 'teams',
      label: 'Team',
      admin: {
        description: 'Team this user belongs to. Teams track payment status and attempt allocation per PRD Section 4.',
      },
      access: {
        update: ({ req: { user } }) => user?.role === 'admin',
        create: ({ req: { user } }) => user?.role === 'admin',
      },
    },
    {
      name: 'dashboardCalendarNotice',
      type: 'group',
      label: 'Dashboard Calendar Notice',
      admin: {
        condition: () => false,
      },
      fields: [
        {
          name: 'version',
          type: 'number',
          defaultValue: 0,
          admin: { readOnly: true },
        },
        {
          name: 'seenVersion',
          type: 'number',
          defaultValue: 0,
          admin: { readOnly: true },
        },
        {
          name: 'reason',
          type: 'select',
          options: [
            { label: 'Partner', value: 'partner' },
            { label: 'Track', value: 'track' },
            { label: 'Partner + Track', value: 'partner_track' },
          ],
          admin: { readOnly: true },
        },
        {
          name: 'previousCalendarLabel',
          type: 'text',
          admin: { readOnly: true },
        },
        {
          name: 'nextCalendarLabel',
          type: 'text',
          admin: { readOnly: true },
        },
        {
          name: 'previousPartnerName',
          type: 'text',
          admin: { readOnly: true },
        },
        {
          name: 'nextPartnerName',
          type: 'text',
          admin: { readOnly: true },
        },
        {
          name: 'previousPartnerLogoUrl',
          type: 'text',
          admin: { readOnly: true },
        },
        {
          name: 'nextPartnerLogoUrl',
          type: 'text',
          admin: { readOnly: true },
        },
        {
          name: 'previousTrackName',
          type: 'text',
          admin: { readOnly: true },
        },
        {
          name: 'nextTrackName',
          type: 'text',
          admin: { readOnly: true },
        },
        {
          name: 'changedAt',
          type: 'date',
          admin: {
            readOnly: true,
            date: { pickerAppearance: 'dayAndTime' },
          },
        },
      ],
    },
    {
      name: 'location',
      type: 'group',
      label: 'Location (Ecosystem Map)',
      admin: {
        description: 'Coordinates for ecosystem mapping. Auto-populated from intake form city/country fields via geocoding.',
      },
      fields: [
        {
          name: 'lat',
          type: 'number',
          label: 'Latitude',
          admin: { step: 0.000001 },
        },
        {
          name: 'lng',
          type: 'number',
          label: 'Longitude',
          admin: { step: 0.000001 },
        },
      ],
    },
    {
      name: 'emailPreferences',
      type: 'group',
      label: 'Email Preferences',
      admin: {
        description: 'Controls which email notifications this user receives.',
      },
      fields: [
        {
          name: 'newsletter',
          type: 'checkbox',
          label: 'Newsletter',
          defaultValue: true,
          admin: { description: 'Receive newsletter and marketing emails.' },
        },
        {
          name: 'attemptNotifications',
          type: 'checkbox',
          label: 'Attempt Notifications',
          defaultValue: true,
          admin: { description: 'Receive miss warnings, attempt failure, and program completion emails.' },
        },
        {
          name: 'paymentReminders',
          type: 'checkbox',
          label: 'Payment Reminders',
          defaultValue: true,
          admin: { description: 'Receive payment-related reminders and invoice emails.' },
        },
        {
          name: 'gateNotifications',
          type: 'checkbox',
          label: 'Gate & Review Notifications',
          defaultValue: true,
          admin: { description: 'Receive gate decision and mentor review emails.' },
        },
        {
          name: 'programUpdates',
          type: 'checkbox',
          label: 'Program Updates',
          defaultValue: true,
          admin: { description: 'Receive daily submission confirmations and program progress emails.' },
        },
      ],
    },
        {
          name: 'invoiceData',
          type: 'group',
      label: 'Invoice / Billing Data',
      admin: {
        description: 'VAT invoice details provided by the user at time of payment.',
      },
      access: {
        read: ({ req: { user }, id }) => user?.role === 'admin' || (user != null && String(user.id) === String(id)),
        update: ({ req: { user } }) => user?.role === 'admin',
        create: ({ req: { user } }) => user?.role === 'admin',
      },
      fields: [
        { name: 'wantInvoice', type: 'checkbox', label: 'Requested Invoice', defaultValue: false },
        { name: 'companyName', type: 'text', label: 'Company Name / Full Name' },
        { name: 'nip', type: 'text', label: 'NIP (Tax ID)' },
        { name: 'address', type: 'text', label: 'Street & Number' },
        { name: 'city', type: 'text', label: 'City' },
        { name: 'postalCode', type: 'text', label: 'Postal Code' },
        { name: 'country', type: 'text', label: 'Country Code', defaultValue: 'PL' },
        { name: 'invoiceEmail', type: 'email', label: 'Invoice Email (if different from account email)' },
        {
          name: 'invoiceSent',
          type: 'checkbox',
          label: 'Invoice Email Sent',
          defaultValue: false,
          admin: { description: 'Set automatically after the invoice email has been dispatched.' },
        },
        {
          name: 'paidAmountGroszy',
          type: 'number',
          label: 'Paid Amount (grosz)',
          admin: { description: 'Actual amount charged in grosz (after discounts/partner pricing). Set at payment initiation.' },
        },
        {
          name: 'pendingDiscountCodeId',
          type: 'text',
          label: 'Pending Discount Code ID',
          admin: { description: 'Discount code ID reserved for the in-progress payment. Cleared after confirmation or failure.' },
        },
        {
          name: 'legalConsentAudit',
          type: 'group',
          label: 'Legal Consent Audit',
          admin: {
            description: 'Snapshot of the legal consents and active documents accepted during the latest payment initiation.',
          },
          fields: [
            { name: 'lang', type: 'text', label: 'Consent Language' },
            { name: 'acceptedTermsAt', type: 'date', label: 'Terms Accepted At', admin: { date: { pickerAppearance: 'dayAndTime' } } },
            { name: 'acceptedPrivacyAt', type: 'date', label: 'Privacy Accepted At', admin: { date: { pickerAppearance: 'dayAndTime' } } },
            { name: 'acceptedWithdrawalAt', type: 'date', label: 'Withdrawal Accepted At', admin: { date: { pickerAppearance: 'dayAndTime' } } },
            { name: 'termsDocumentId', type: 'text', label: 'Terms Document ID' },
            { name: 'termsDocumentTitle', type: 'text', label: 'Terms Document Title' },
            { name: 'termsDocumentUpdatedAt', type: 'date', label: 'Terms Document Updated At', admin: { date: { pickerAppearance: 'dayAndTime' } } },
            { name: 'privacyDocumentId', type: 'text', label: 'Privacy Document ID' },
            { name: 'privacyDocumentTitle', type: 'text', label: 'Privacy Document Title' },
            { name: 'privacyDocumentUpdatedAt', type: 'date', label: 'Privacy Document Updated At', admin: { date: { pickerAppearance: 'dayAndTime' } } },
          ],
        },
      ],
    },
  ],
}
