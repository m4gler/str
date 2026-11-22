import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { sections as founderSections } from '@/components/FounderForm/data'

const MAIN_FORM_SLUG = 'founder-intake-v1'
const MAIN_FORM_TITLE = 'Founder Intake Form'
const PERSONALITY_FORM_SLUG = 'personality_test'
const PERSONALITY_FORM_TITLE = 'Personality test'

const PERSONALITY_SECTION_IDS = [
  'quality_control',
  'big_five',
  'self_efficacy',
  'risk_taking',
  'behavioral_anchors',
  'mesga_fit',
] as const

const PERSONALITY_SECTION_TITLES: Record<string, string> = {
  quality_control: '2 Quality Control',
  big_five: '3 Core Personality',
  self_efficacy: '4 Self-Efficacy',
  risk_taking: '5 Risk-Taking',
  behavioral_anchors: '6 Behavioral Evidence',
  mesga_fit: '7 MESGA Fit',
}

const PERSONALITY_WELCOME_SECTION = {
  id: 'welcome',
  title: '1 Welcome',
  description: 'Consent and instructions for the personality assessment.',
  questions: [
    {
      question_id: 'S0_CONSENT',
      question_text:
        'Consent: I agree that MESGA / Bakery Ventures may use my answers to personalize program support.',
      question_type: 'multiple_choice_single',
      required: true,
      choices: [
        { label: 'Yes, I consent', value: 'Yes' },
        { label: 'No', value: 'No' },
      ],
      helperText: 'Required to continue with the personality assessment.',
    },
  ],
} as const

type FormQuestion = {
  question_id: string
  question_text: string
  question_type: string
  required?: boolean
  choices?: Array<{ label: string; value: string }>
  placeholder?: string
  helperText?: string
}

type FormSection = {
  id: string
  title: string
  description?: string
  questions: FormQuestion[]
}

function cloneQuestion(question: any): FormQuestion {
  return {
    question_id: question.question_id,
    question_text: question.question_text,
    question_type: question.question_type,
    required: Boolean(question.required),
    ...(Array.isArray(question.choices) ? { choices: question.choices.map((choice: any) => ({ ...choice })) } : {}),
    ...(question.placeholder ? { placeholder: question.placeholder } : {}),
    ...(question.helperText ? { helperText: question.helperText } : {}),
  }
}

function cloneSection(section: any): FormSection {
  return {
    id: section.id,
    title: section.title,
    ...(section.description ? { description: section.description } : {}),
    questions: section.questions.map(cloneQuestion),
  }
}

function buildMainFounderSections(): FormSection[] {
  return founderSections
    .filter((section) => !(PERSONALITY_SECTION_IDS as readonly string[]).includes(section.id))
    .map(cloneSection)
}

function buildPersonalitySections(): FormSection[] {
  const derivedSections = founderSections
    .filter((section) => PERSONALITY_SECTION_IDS.includes(section.id as (typeof PERSONALITY_SECTION_IDS)[number]))
    .map((section) => {
      const cloned = cloneSection(section)
      return {
        ...cloned,
        title: PERSONALITY_SECTION_TITLES[cloned.id] || cloned.title,
      }
    })

  return [cloneSection(PERSONALITY_WELCOME_SECTION), ...derivedSections]
}

async function upsertFounderForm(payload: Awaited<ReturnType<typeof getPayload>>, options: {
  slug: string
  title: string
  sections: FormSection[]
  showReferredBy?: boolean
}) {
  const existing = await payload.find({
    collection: 'founder-forms',
    where: {
      slug: {
        equals: options.slug,
      },
    },
    limit: 1,
    depth: 0,
  })

  const data = {
    title: options.title,
    sections: options.sections as any,
    ...(typeof options.showReferredBy === 'boolean' ? { showReferredBy: options.showReferredBy } : {}),
  }

  if (existing.totalDocs > 0) {
    console.log(`Updating ${options.slug}...`)
    const updated = await payload.update({
      collection: 'founder-forms',
      id: existing.docs[0].id,
      data,
    })

    return updated.id
  }

  console.log(`Creating ${options.slug}...`)
  const created = await payload.create({
    collection: 'founder-forms',
    data: {
      ...data,
      slug: options.slug,
    },
  })

  return created.id
}

async function seed() {
  const payload = await getPayload({ config })

  const founderFormId = await upsertFounderForm(payload, {
    slug: MAIN_FORM_SLUG,
    title: MAIN_FORM_TITLE,
    sections: buildMainFounderSections(),
  })

  const personalityFormId = await upsertFounderForm(payload, {
    slug: PERSONALITY_FORM_SLUG,
    title: PERSONALITY_FORM_TITLE,
    sections: buildPersonalitySections(),
  })

  const settings = (await payload.findGlobal({
    slug: 'platform-settings',
  }).catch(() => null)) as any

  const activeFounderFormId =
    typeof settings?.activeFounderForm === 'object'
      ? settings.activeFounderForm?.id
      : settings?.activeFounderForm
  const activePersonalityFormId =
    typeof settings?.activePersonalityTestForm === 'object'
      ? settings.activePersonalityTestForm?.id
      : settings?.activePersonalityTestForm

  if (
    String(activeFounderFormId || '') !== String(founderFormId) ||
    String(activePersonalityFormId || '') !== String(personalityFormId)
  ) {
    console.log('Updating PlatformSettings active founder forms...')
    await payload.updateGlobal({
      slug: 'platform-settings',
      data: {
        activeFounderForm: founderFormId,
        activePersonalityTestForm: personalityFormId,
      },
    })
  }

  console.log('Founder forms seed completed successfully.')
  process.exit(0)
}

seed().catch((error) => {
  console.error('seed-core-founder-forms failed:', error)
  process.exit(1)
})
