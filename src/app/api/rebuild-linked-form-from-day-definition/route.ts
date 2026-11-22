import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { headers as getHeaders } from 'next/headers'
import config from '@/payload.config'
import { upsertFounderFormFromCurriculum } from '@/lib/dayDefinitionForms'

/**
 * POST /api/rebuild-linked-form-from-day-definition
 *
 * Admin-only. Rebuilds the canonical linked FounderForm from a DayDefinition's
 * curriculum fields, then re-links the form back to that record.
 *
 * Body: { dayDefinitionId: string | number }
 */
export async function POST(request: NextRequest) {
  const payload = await getPayload({ config })
  const hdrs = await getHeaders()

  const { user } = await payload.auth({ headers: hdrs })
  if (!user || (user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { dayDefinitionId } = body

  if (!dayDefinitionId) {
    return NextResponse.json({ error: 'dayDefinitionId is required' }, { status: 400 })
  }

  const dd = await payload.findByID({
    collection: 'day-definitions',
    id: dayDefinitionId,
    depth: 0,
  }).catch(() => null) as any

  if (!dd) {
    return NextResponse.json({ error: 'Day definition not found' }, { status: 404 })
  }

  if (dd.definitionKind === 'override') {
    return NextResponse.json(
      { error: 'Linked forms can only be rebuilt from base curriculum definitions, not override records.' },
      { status: 400 },
    )
  }

  const result = await upsertFounderFormFromCurriculum(payload, dd)

  await payload.update({
    collection: 'day-definitions',
    id: dd.id,
    data: { linkedForm: result.formId },
  })

  return NextResponse.json({
    success: true,
    formId: result.formId,
    slug: result.slug,
    title: result.title,
    questionsCount: result.questionsCount,
    message: `Canonical linked form "${result.title}" (${result.slug}) ${result.action} from curriculum fields.`,
  })
}
