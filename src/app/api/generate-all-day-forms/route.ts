import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { headers as getHeaders } from 'next/headers'
import { generateFounderFormsFromCurriculum } from '@/lib/curriculum/admin'

/**
 * POST /api/generate-all-day-forms
 *
 * Admin-only. Iterates active-release base DayDefinitions and generates
 * canonical FounderForms from curriculum fields, then updates linkedForm.
 *
 * Derived weekly retro and gate forms still come from Day Program config,
 * not from separate imported DayDefinition records.
 *
 * Body: { blockTypes?: string[], assignToSchedule?: boolean }
 */
export async function POST(request: NextRequest) {
  const payload = await getPayload({ config })
  const hdrs = await getHeaders()

  const { user } = await payload.auth({ headers: hdrs })
  if (!user || (user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))

  try {
    const result = await generateFounderFormsFromCurriculum(payload, {
      blockTypes: body.blockTypes || ['day', 'prework', 'gate', 'weekly'],
      assignToSchedule: body.assignToSchedule !== false,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Founder form generation failed' },
      { status: 500 },
    )
  }
}
