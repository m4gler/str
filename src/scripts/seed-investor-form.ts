import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@/payload.config'
import {
  CANONICAL_ARCHETYPES,
} from '@/lib/curriculum/constants'

/**
 * Seed / update the canonical investor-intake-v1 form in Payload.
 *
 * This is the single source of truth for the investor form structure.
 * All question texts, choices, helper texts, and placeholders are defined here.
 *
 * Run via: POST /api/seed-investor-form (admin-only)
 * Or directly: npx tsx src/scripts/seed-investor-form.ts
 */

const COUNTRY_CODE_BLACKLIST = new Set([
  'AC', 'AN', 'BU', 'CP', 'CQ', 'DG', 'EA', 'EU', 'EZ', 'FX',
  'IC', 'QO', 'TA', 'UN', 'XA', 'XB', 'ZZ',
])

function buildCountryChoices(): { label: string; value: string }[] {
  const displayNames = new Intl.DisplayNames(['en'], { type: 'region' })
  const seenLabels = new Set<string>()
  const choices: { label: string; value: string }[] = []

  for (let first = 65; first <= 90; first++) {
    for (let second = 65; second <= 90; second++) {
      const code = String.fromCharCode(first) + String.fromCharCode(second)
      if (COUNTRY_CODE_BLACKLIST.has(code)) continue

      const label = displayNames.of(code)
      if (!label || label === code || /pseudo|unknown region/i.test(label)) continue
      if (seenLabels.has(label)) continue

      seenLabels.add(label)
      choices.push({ label, value: label })
    }
  }

  return choices.sort((left, right) => left.label.localeCompare(right.label, 'en'))
}

const archetypeChoices = CANONICAL_ARCHETYPES.map((a) => ({
  label: `${a.key} — ${a.tagline}`,
  value: a.key,
}))

const sections = [
  {
    title: 'Consent & Basics',
    questions: [
      {
        question_id: 'I0_CONSENT',
        question_text:
          'Consent: I agree that MESGA / Bakery Ventures may use my answers for matchmaking and aggregated ecosystem reporting.',
        question_type: 'yes_no',
        required: true,
      },
      {
        question_id: 'I0_NAME',
        question_text: 'Full name',
        question_type: 'short_text',
        required: true,
      },
      {
        question_id: 'I0_EMAIL',
        question_text: 'Email',
        question_type: 'email',
        required: true,
      },
      // I0_ROLE intentionally removed — hidden in runtime, not needed in form
      {
        question_id: 'I0_ENTITY',
        question_text: 'Investing / participating as',
        question_type: 'multiple_choice_single',
        required: true,
        choices: [
          { label: 'Individual', value: 'Individual' },
          { label: 'Fund', value: 'Fund' },
          { label: 'Syndicate', value: 'Syndicate' },
          { label: 'Family Office', value: 'Family Office' },
          { label: 'Corporate', value: 'Corporate' },
          { label: 'Mentor (non-investor)', value: 'Mentor (non-investor)' },
          { label: 'Other', value: 'Other' },
        ],
      },
      {
        question_id: 'I0_LINKEDIN',
        question_text: 'LinkedIn URL',
        question_type: 'url',
        required: false,
      },
      {
        question_id: 'I0_WEBSITE',
        question_text: 'Website (optional)',
        question_type: 'url',
        required: false,
      },
    ],
  },
  {
    title: 'Identity',
    questions: [
      {
        question_id: 'I1_COUNTRY',
        question_text: 'Country of residence',
        question_type: 'dropdown',
        required: true,
        choices: buildCountryChoices(),
        placeholder: 'Select your country',
        // No helperText — clean
      },
      {
        question_id: 'I1_CITY',
        question_text: 'City (optional)',
        question_type: 'short_text',
        required: false,
      },
      {
        question_id: 'I1_INVESTOR_TYPE',
        question_text: 'Investor / mentor type',
        question_type: 'multiple_choice_single',
        required: true,
        choices: [
          { label: 'Angel', value: 'Angel' },
          { label: 'Angel syndicate lead', value: 'Angel syndicate lead' },
          { label: 'Micro-VC', value: 'Micro-VC' },
          { label: 'VC', value: 'VC' },
          { label: 'CVC', value: 'CVC' },
          { label: 'Family office', value: 'Family office' },
          { label: 'Accelerator / Program', value: 'Accelerator / Program' },
          { label: 'Mentor only (non-investor)', value: 'Mentor only' },
          { label: 'Other', value: 'Other' },
        ],
      },
      {
        question_id: 'I1_JURISDICTION',
        question_text: 'Jurisdiction you commonly invest under (optional)',
        question_type: 'multiple_choice_multiple',
        required: false,
        choices: [
          { label: 'EU', value: 'EU' },
          { label: 'UK', value: 'UK' },
          { label: 'US', value: 'US' },
          { label: 'Poland', value: 'Poland' },
          { label: 'Estonia', value: 'Estonia' },
          { label: 'Ireland', value: 'Ireland' },
          { label: 'Luxembourg', value: 'Luxembourg' },
          { label: 'Other', value: 'Other' },
        ],
      },
      {
        question_id: 'I1_FOUNDER_BEFORE',
        question_text: 'Have you previously founded a company? (optional)',
        question_type: 'yes_no',
        required: false,
      },
    ],
  },
  {
    title: 'Investment Mandate',
    questions: [
      // I4_COUNTRIES_OK intentionally removed — hidden in runtime, not needed in form
      {
        question_id: 'I3_STAGE_FOCUS',
        question_text: 'Which stages do you invest in / support?',
        question_type: 'multiple_choice_multiple',
        required: true,
        choices: [
          { label: 'Pre-seed', value: 'Pre-seed' },
          { label: 'Seed', value: 'Seed' },
          { label: 'Series A', value: 'Series A' },
          { label: 'Series B+', value: 'Series B+' },
          { label: 'Any / Stage-agnostic', value: 'Any' },
        ],
      },
      {
        question_id: 'I3_CHECK_MIN',
        question_text: 'Typical check size MIN (EUR)',
        question_type: 'number',
        required: false,
      },
      {
        question_id: 'I3_CHECK_MAX',
        question_text: 'Typical check size MAX (EUR)',
        question_type: 'number',
        required: false,
      },
      {
        question_id: 'I3_LEAD_STYLE',
        question_text: 'Do you lead rounds?',
        question_type: 'multiple_choice_single',
        required: false,
        choices: [
          { label: 'Lead', value: 'Lead' },
          { label: 'Co-lead', value: 'Co-lead' },
          { label: 'Non-lead only', value: 'Non-lead only' },
          { label: 'Either', value: 'Either' },
          { label: 'N/A \u2013 mentor only', value: 'N/A' },
        ],
      },
      {
        question_id: 'I3_DECISION_SPEED',
        question_text: 'Typical decision speed',
        question_type: 'multiple_choice_single',
        required: false,
        choices: [
          { label: '< 2 weeks', value: '< 2 weeks' },
          { label: '2\u20134 weeks', value: '2\u20134 weeks' },
          { label: '1\u20132 months', value: '1\u20132 months' },
          { label: '> 2 months', value: '> 2 months' },
          { label: 'N/A \u2013 mentor only', value: 'N/A' },
        ],
      },
      {
        question_id: 'I3_RESTRICTIONS',
        question_text: 'Any hard restrictions or conflicts?',
        question_type: 'long_text',
        required: false,
        placeholder: 'Leave blank if none',
        helperText: 'Use short keywords or a short sentence if needed.',
      },
    ],
  },
  {
    title: 'Strategy & Expertise',
    questions: [
      {
        question_id: 'I5_SECTOR_FOCUS',
        question_text: 'Sector focus (select all that apply)',
        question_type: 'multiple_choice_multiple',
        required: true,
        choices: [
          { label: 'Software & Data', value: 'Software & Data' },
          { label: 'Commerce & Retail', value: 'Commerce & Retail' },
          { label: 'Health & Life Sciences', value: 'Health & Life Sciences' },
          { label: 'Financial Services', value: 'Financial Services' },
          { label: 'Legal Tech / Legal & IP', value: 'Legal Tech / Legal & IP' },
          { label: 'Education & Work', value: 'Education & Work' },
          { label: 'Media / Social / Leisure', value: 'Media / Social / Leisure' },
          { label: 'Hardware / IoT', value: 'Hardware / IoT' },
          { label: 'Marketing & Sales', value: 'Marketing & Sales' },
          { label: 'Food & Agriculture', value: 'Food & Agriculture' },
          { label: 'Energy & Environment', value: 'Energy & Environment' },
          { label: 'Mobility & Transport', value: 'Mobility & Transport' },
          { label: 'Space & Security', value: 'Space & Security' },
        ],
      },
      {
        question_id: 'I6_DOMAIN_EXPERTISE',
        question_text: 'Your domain expertise (pick up to 5)',
        question_type: 'multiple_choice_multiple',
        required: true,
        helperText: 'Select up to 5 areas where you have the strongest domain edge.',
        choices: [
          { label: 'Banking / Insurance', value: 'Banking / Insurance' },
          { label: 'Logistics / Supply chain', value: 'Logistics / Supply chain' },
          { label: 'Healthcare delivery', value: 'Healthcare delivery' },
          { label: 'Biotech / Pharma', value: 'Biotech / Pharma' },
          { label: 'Climate / Energy', value: 'Climate / Energy' },
          { label: 'Mobility / Automotive', value: 'Mobility / Automotive' },
          { label: 'Space / Aerospace', value: 'Space / Aerospace' },
          { label: 'Cybersecurity', value: 'Cybersecurity' },
          { label: 'Retail / e-commerce', value: 'Retail / e-commerce' },
          { label: 'HR / Future of work', value: 'HR / Future of work' },
          { label: 'Gov / regulated industries', value: 'Gov / regulated industries' },
          { label: 'Legal / Compliance / RegTech', value: 'Legal / Compliance / RegTech' },
          { label: 'Other', value: 'Other' },
        ],
      },
      {
        question_id: 'I7_VALUE_ADD',
        question_text: 'How can you help founders? (select all that apply)',
        question_type: 'multiple_choice_multiple',
        required: true,
        helperText: 'Select the areas where you can be genuinely helpful to founders.',
        choices: [
          { label: 'Fundraising strategy', value: 'Fundraising strategy' },
          { label: 'Investor intros', value: 'Investor intros' },
          { label: 'Enterprise sales (GTM)', value: 'Enterprise sales (GTM)' },
          { label: 'Hiring & org design', value: 'Hiring & org design' },
          { label: 'Product strategy / PMF', value: 'Product strategy / PMF' },
          { label: 'Pricing / packaging', value: 'Pricing / packaging' },
          { label: 'Growth / marketing', value: 'Growth / marketing' },
          { label: 'Pitch Deck & Pitching', value: 'Pitch Deck & Pitching' },
          { label: 'Branding & Marketing', value: 'Branding & Marketing' },
          { label: 'Partnerships', value: 'Partnerships' },
          { label: 'Legal & IP', value: 'Legal & IP' },
          { label: 'Tech / architecture', value: 'Tech / architecture' },
          { label: 'Other', value: 'Other' },
        ],
      },
      {
        question_id: 'I8_ARCHETYPE_FIT',
        question_text: 'Which founder archetypes do you work best with?',
        question_type: 'multiple_choice_multiple',
        required: false,
        helperText: 'Pick the founder working styles you support best.',
        choices: archetypeChoices,
      },
      {
        question_id: 'I8_CONNECT_TO_STARTUPS',
        question_text: 'Do you want us to connect you to startups?',
        question_type: 'yes_no',
        required: true,
        helperText: 'Used for MESGA startup matchmaking preferences.',
      },
      {
        question_id: 'I9_CONNECT_TO_PEERS',
        question_text: 'Do you want to be connected to other mentors / investors?',
        question_type: 'yes_no',
        required: true,
        helperText: 'Used for curated peer-network introductions inside the MESGA ecosystem.',
      },
    ],
  },
  {
    title: 'Matchmaking Preferences',
    questions: [
      {
        question_id: 'Q4_FOUNDER_MATCH',
        question_text: 'Do you want to be matched with founders?',
        question_type: 'multiple_choice_single',
        required: false,
        helperText: 'We use this to tailor founder introductions.',
        choices: [
          { label: 'Yes, actively', value: 'Yes, actively' },
          { label: 'Yes, selectively', value: 'Yes, selectively' },
          { label: 'Not right now', value: 'Not right now' },
        ],
      },
      {
        question_id: 'Q4_MATCH_CRITERIA',
        question_text: 'What matters most when matching you with a founder?',
        question_type: 'multiple_choice_multiple',
        required: false,
        logic: 'SHOW_IF:Q4_FOUNDER_MATCH:Yes, actively|Yes, selectively',
        choices: [
          { label: 'Sector fit', value: 'Sector fit' },
          { label: 'Stage fit', value: 'Stage fit' },
          { label: 'Geography', value: 'Geography' },
          { label: 'Founder archetype', value: 'Founder archetype' },
          { label: 'Team size', value: 'Team size' },
          { label: 'Revenue / traction', value: 'Revenue / traction' },
        ],
      },
      {
        question_id: 'Q5_NETWORK_MATCH',
        question_text: 'Do you want to be introduced to other investors / mentors?',
        question_type: 'multiple_choice_single',
        required: false,
        helperText: 'We use this to tailor investor and mentor introductions.',
        choices: [
          { label: 'Yes, actively', value: 'Yes, actively' },
          { label: 'Yes, selectively', value: 'Yes, selectively' },
          { label: 'Not right now', value: 'Not right now' },
        ],
      },
    ],
  },
]

const seed = async () => {
  const payload = await getPayload({ config })

  const existingForms = await payload.find({
    collection: 'investor-forms',
    where: { slug: { equals: 'investor-intake-v1' } },
  })

  if (existingForms.totalDocs > 0) {
    console.log('Updating existing investor form...')
    await payload.update({
      collection: 'investor-forms',
      id: existingForms.docs[0].id,
      data: {
        title: 'Investor / Mentor Intake Form',
        sections: sections as any,
      },
    })
  } else {
    console.log('Creating new investor form...')
    await payload.create({
      collection: 'investor-forms',
      data: {
        title: 'Investor / Mentor Intake Form',
        slug: 'investor-intake-v1',
        sections: sections as any,
      },
    })
  }

  console.log('Seed completed successfully.')
  process.exit(0)
}

seed()
