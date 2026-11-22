import type { CollectionConfig } from 'payload'
import {
  buildDefinitionKey,
  CURRICULUM_DEFAULT_RELEASE_KEY,
  GENERAL_DIMENSION_VALUE,
  normalizeArchetypeKey,
  normalizeVariantTrackLabel,
  normalizeVerticalLabel,
} from '@/lib/curriculum/constants'
import { upsertFounderFormFromCurriculum } from '@/lib/dayDefinitionForms'

export const DayDefinitions: CollectionConfig = {
  slug: 'day-definitions',
  trash: true,
  admin: {
    useAsTitle: 'title',
    group: '📅 Day Program',
    description: 'Curriculum blocks resolved from GENERAL plus dimension-specific overrides. Supports vertical, personality, and future track-injection variants.',
    defaultColumns: ['title', 'definitionKind', 'blockType', 'blockKey', 'releaseKey', 'vertical', 'personality', 'track'],
    listSearchableFields: ['title', 'blockKey', 'definitionKey', 'theme', 'questionId', 'sourceSheet'],
    components: {
      views: {
        edit: {
          default: {
            Component: '@/components/Payload/DayDefinitionEditor#default',
          },
        },
        list: {
          Component: '@/components/Payload/DayDefinitionEditor#default',
        },
      },
    },
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data

        data.definitionKind = data.definitionKind === 'override' ? 'override' : 'base'
        data.releaseKey = String(data.releaseKey || CURRICULUM_DEFAULT_RELEASE_KEY).trim() || CURRICULUM_DEFAULT_RELEASE_KEY
        data.vertical = normalizeVerticalLabel(data.vertical || GENERAL_DIMENSION_VALUE)
        data.personality = normalizeArchetypeKey(data.personality || GENERAL_DIMENSION_VALUE)
        data.track = normalizeVariantTrackLabel(data.track || GENERAL_DIMENSION_VALUE)
        data.definitionKey = buildDefinitionKey({
          releaseKey: data.releaseKey,
          blockKey: data.blockKey,
          vertical: data.vertical,
          personality: data.personality,
          track: data.track,
        })

        if (!data.title && data.activity) {
          data.title = data.activity
        }

        data.hasVerticalVariants = Boolean(data.hasVerticalVariants)
        data.hasPersonalityVariants = Boolean(data.hasPersonalityVariants)
        data.hasTrackVariants = Boolean(data.hasTrackVariants)

        return data
      },
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation !== 'create' && operation !== 'update') return doc
        if (req.context?.skipLinkedFormSync === true) return doc
        if (doc.definitionKind === 'override') return doc

        const result = await upsertFounderFormFromCurriculum(req.payload, doc)
        const currentLinkedFormId = typeof doc.linkedForm === 'object' ? doc.linkedForm?.id : doc.linkedForm

        if (String(currentLinkedFormId || '') !== String(result.formId || '')) {
          await req.payload.update({
            collection: 'day-definitions',
            id: doc.id,
            data: { linkedForm: result.formId },
            context: {
              skipLinkedFormSync: true,
            },
          })
        }

        return doc
      },
    ],
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => user?.role === 'admin',
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    // ── Identity ──
    {
      name: 'definitionKey',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Computed unique key: release + blockKey + vertical + personality + track.',
        readOnly: true,
      },
    },
    {
      name: 'releaseKey',
      type: 'text',
      required: true,
      defaultValue: CURRICULUM_DEFAULT_RELEASE_KEY,
      index: true,
      admin: { description: `Curriculum release version resolved from the Excel META tab, e.g. "${CURRICULUM_DEFAULT_RELEASE_KEY}".` },
    },
    {
      name: 'definitionKind',
      type: 'select',
      required: true,
      defaultValue: 'base',
      options: [
        { label: 'Base (GENERAL)', value: 'base' },
        { label: 'Override (vertical / personality / track)', value: 'override' },
      ],
      index: true,
      admin: { description: 'Base records come from GENERAL. Override records store only diffs for a specific dimension context.' },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: { description: 'Display title, e.g. "Day 1: FMF I: Anti-portfolio & Why"' },
    },
    {
      name: 'blockType',
      type: 'select',
      required: true,
      options: [
        { label: 'Day Block (1–100)', value: 'day' },
        { label: 'Prework Block', value: 'prework' },
        { label: 'IC Gate Pack', value: 'gate' },
        { label: 'Weekly Retro', value: 'weekly' },
        { label: 'Welcome', value: 'welcome' },
        { label: 'Team Identity', value: 'team' },
        { label: 'Daily Log Header', value: 'daily_log' },
        { label: 'End', value: 'end' },
      ],
      index: true,
    },
    {
      name: 'blockKey',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'Logical curriculum block key from Excel, e.g. DAY-BLOCK-1. Not globally unique anymore because variants can share the same block.' },
    },
    {
      name: 'dayNumber',
      type: 'number',
      index: true,
      admin: { description: 'Day number (1–100 for day blocks, 1–10 for prework, 15/30/50/70/94 for gates)' },
    },
    {
      name: 'order',
      type: 'number',
      admin: { description: 'Global sort order from spreadsheet' },
    },

    // ── Three Dimensions: Vertical / Personality / Track ──
    {
      name: 'vertical',
      type: 'text',
      defaultValue: GENERAL_DIMENSION_VALUE,
      index: true,
      admin: { description: 'Resolved sector/vertical context. Base GENERAL docs use "General"; overrides use a concrete vertical like "Dual Use".' },
    },
    {
      name: 'track',
      type: 'text',
      defaultValue: GENERAL_DIMENSION_VALUE,
      index: true,
      admin: { description: 'Third curriculum dimension reserved for track injections / sponsor-specific variants. Base docs use "General".' },
    },
    {
      name: 'personality',
      type: 'text',
      defaultValue: GENERAL_DIMENSION_VALUE,
      admin: { description: 'Personality archetype dimension. Base docs use "General"; overrides use canonical Excel archetype names.' },
    },
    {
      name: 'hasVerticalVariants',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Derived from GENERAL marker "▲ Vertical-specific". Signals that this base block expects vertical overrides.' },
    },
    {
      name: 'hasPersonalityVariants',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Derived from GENERAL marker "◆ Archetype-specific". Signals that this base block expects personality overrides.' },
    },
    {
      name: 'hasTrackVariants',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Derived from GENERAL marker "● Track injection". Signals that this base block expects future track-injection overrides.' },
    },
    {
      name: 'sourceSheet',
      type: 'text',
      admin: { description: 'Workbook sheet that produced this record, e.g. GENERAL, DUAL USE, PERSONALITY GUIDE.' },
    },
    {
      name: 'sourceRowNumber',
      type: 'number',
      admin: { description: '1-based source row number from the workbook for debugging and quick traceability.' },
    },
    {
      name: 'qaSourceSheet',
      type: 'text',
      admin: { description: 'Optional QA-only source sheet used to enrich the base definition, typically GENERAL TEST.' },
    },
    {
      name: 'qaSourceRowNumber',
      type: 'number',
      admin: { description: '1-based row number in the QA worksheet.' },
    },
    {
      name: 'overrideFields',
      type: 'json',
      admin: { description: 'Only used on override records. Stores the minimal patch that should be merged onto the base GENERAL block.' },
    },

    // ── Curriculum metadata ──
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Curriculum',
          fields: [
            {
              name: 'weekNumber',
              type: 'number',
              admin: { description: 'Week number (0 = prework, 1–15 for program)' },
            },
            {
              name: 'theme',
              type: 'text',
              admin: { description: 'e.g. "Ideation / Founder-Idea-Fit"' },
            },
            {
              name: 'founderCommandment',
              type: 'text',
              admin: { description: 'Guiding principle, e.g. "Founder-Idea-Fit before feature-fit"' },
            },
            {
              name: 'blockFocus',
              type: 'text',
              admin: { description: 'Block focus area, e.g. "FMF + ICP hypotheses"' },
            },
            {
              name: 'mainSoetMission',
              type: 'text',
              admin: { description: 'SOET mission alignment (Empower Talent, etc.)' },
            },
            {
              name: 'activity',
              type: 'text',
              admin: { description: 'Activity title shown to founder' },
            },
            {
              name: 'deliverable',
              type: 'textarea',
              admin: { description: 'What the founder must produce' },
            },
            {
              name: 'exampleProject',
              type: 'textarea',
              admin: { description: 'Example startup output pulled from the workbook sample-answer column.' },
            },
            {
              name: 'whereHowTips',
              type: 'textarea',
              admin: { description: 'Guidance on where/how to do this task' },
            },
            {
              name: 'autoCheckCriteria',
              type: 'textarea',
              admin: { description: 'AI/human auto-check criteria, e.g. "≥300 words; ≥2 time-stamped trends"' },
            },
            {
              name: 'mesgaIntegration',
              type: 'text',
              admin: { description: 'MESGA tool/canvas integration reference' },
            },
            {
              name: 'estimatedTimeHrs',
              type: 'number',
              admin: { description: 'Estimated hours to complete' },
            },
            {
              name: 'qaTimeBreakdown',
              type: 'textarea',
              admin: { description: 'Internal-only timebox breakdown imported from GENERAL TEST, e.g. "4h → [1.5h reading | 1.5h writing | 1h review]".' },
            },
            {
              name: 'coachingNote',
              type: 'textarea',
              admin: { description: 'Archetype-specific coaching note resolved from the PERSONALITY GUIDE divergent-day matrix.' },
            },
            {
              name: 'divergenceNotes',
              type: 'json',
              admin: { description: 'Cell comments from the Excel workbook describing vertical/personality/track divergence for this day. Array of { type, text } objects.' },
            },
          ],
        },
        {
          label: 'Educational Content',
          fields: [
            {
              name: 'eduType',
              type: 'text',
              admin: { description: 'Educational content type: link / Text / Audio / Video / Deck/PPT' },
            },
            {
              name: 'eduDescription',
              type: 'textarea',
              admin: { description: 'Description of educational content' },
            },
            {
              name: 'contentType',
              type: 'text',
              admin: { description: 'Content ownership: MESGA / OWN / FREE / PAID / SPONSORED / GOV/EU' },
            },
            {
              name: 'contentOwner',
              type: 'text',
              admin: { description: 'Content owner or sponsor name' },
            },
            {
              name: 'eduLinks',
              type: 'array',
              admin: { description: 'Links to educational resources' },
              fields: [
                { name: 'label', type: 'text', required: true },
                { name: 'url', type: 'text', required: true },
                { name: 'type', type: 'select', options: [
                  { label: 'Video', value: 'video' },
                  { label: 'Article', value: 'article' },
                  { label: 'Deck/PPT', value: 'deck' },
                  { label: 'Audio', value: 'audio' },
                  { label: 'Template', value: 'template' },
                  { label: 'Tool', value: 'tool' },
                  { label: 'Other', value: 'other' },
                ]},
              ],
            },
          ],
        },
        {
          label: 'Questions',
          fields: [
            {
              name: 'questions',
              type: 'array',
              admin: {
                description: 'Legacy/manual fallback questions stored directly on the DayDefinition. Imported workbook records should use linkedForm as the canonical submission source.',
              },
              fields: [
                {
                  name: 'questionId',
                  type: 'text',
                  required: true,
                  admin: { description: 'Unique ID, e.g. DP1-001, PW01-002, G15-003' },
                },
                {
                  name: 'questionTitle',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'questionType',
                  type: 'select',
                  required: true,
                  options: [
                    { label: 'Statement (read-only)', value: 'statement' },
                    { label: 'Short Text', value: 'short_text' },
                    { label: 'Long Text', value: 'long_text' },
                    { label: 'Email', value: 'email' },
                    { label: 'Website URL', value: 'website_url' },
                    { label: 'Number', value: 'number' },
                    { label: 'Yes/No', value: 'yes_no' },
                    { label: 'Multiple Choice', value: 'multiple_choice' },
                    { label: 'Dropdown', value: 'dropdown' },
                    { label: 'Opinion Scale (1–10)', value: 'opinion_scale' },
                    { label: 'File Upload', value: 'file_upload' },
                  ],
                },
                {
                  name: 'required',
                  type: 'checkbox',
                  defaultValue: false,
                },
                {
                  name: 'description',
                  type: 'textarea',
                  admin: { description: 'Help text / placeholder shown below the question' },
                },
                {
                  name: 'choices',
                  type: 'text',
                  admin: { description: 'Pipe-separated choices for dropdown/multiple_choice, e.g. "Go|Flip|Kill|Accelerate"' },
                },
                {
                  name: 'logic',
                  type: 'text',
                  admin: { description: 'Conditional logic rule (optional)' },
                },
              ],
            },
          ],
        },
        {
          label: 'Gate Config',
          fields: [
            {
              name: 'isGateDay',
              type: 'checkbox',
              defaultValue: false,
              admin: { description: 'Whether this day is an IC Gate checkpoint' },
            },
            {
              name: 'gateDayNumber',
              type: 'number',
              admin: { description: 'Gate day number: 15, 30, 50, 70, or 94', condition: (data) => data?.isGateDay },
            },
            {
              name: 'gateRequiredArtifacts',
              type: 'textarea',
              admin: { description: 'Required artifacts for gate review', condition: (data) => data?.isGateDay },
            },
            {
              name: 'gateRubric',
              type: 'textarea',
              admin: { description: 'Rubric and scoring criteria', condition: (data) => data?.isGateDay },
            },
            {
              name: 'gateThreshold',
              type: 'text',
              admin: { description: 'Pass threshold description', condition: (data) => data?.isGateDay },
            },
          ],
        },
      ],
    },

    // ── PRD v2.4: Task Clarity & Proof ──
    {
      name: 'definitionOfDone',
      type: 'textarea',
      admin: {
        description: 'Precise acceptance criteria. E.g. "≥10 ideas listed. Each has segment + trigger + outcome. Artifact link accessible."',
        position: 'sidebar',
      },
    },
    {
      name: 'proofTypes',
      type: 'json',
      defaultValue: ['link'],
      admin: {
        description: 'JSON array of accepted proof formats: ["link", "video_link", "file_pdf", "file_ppt", "file_doc", "text", "audio_link"]',
        position: 'sidebar',
      },
    },
    {
      name: 'autoChecks',
      type: 'json',
      admin: {
        description: 'JSON array of auto-check criteria objects. E.g. [{"label":"JTBD cards","type":"number","min":3},{"label":"Has segment+trigger+outcome?","type":"yes_no"}]',
        position: 'sidebar',
      },
    },

    // ── Linked Form (optional override) ──
    {
      name: 'linkedForm',
      type: 'relationship',
      relationTo: 'founder-forms',
      admin: {
        description: 'Canonical submission form for imported curriculum. If present, founder submissions, question counts, and search resolve from this linked FounderForm before any legacy embedded questions.',
        position: 'sidebar',
      },
    },

    // ── Section reference ──
    {
      name: 'section',
      type: 'text',
      admin: {
        description: 'Section from spreadsheet (e.g. "05 Day blocks", "07 IC Gate Pack")',
        position: 'sidebar',
      },
    },
  ],
}
