import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { headers as getHeaders } from 'next/headers'

/**
 * POST /api/fix-required-fields
 *
 * Admin-only. Fixes embedded legacy DayDefinition questions only:
 * - Statements → required: false
 * - Questions with "optional" in title or description → required: false
 * - Everything else → required: true
 *
 * Body: { dryRun?: boolean }
 */
export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const hdrs = await getHeaders()

  const { user } = await payload.auth({ headers: hdrs })
  if (!user || (user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const dryRun = body.dryRun === true

  const allDefs = await payload.find({
    collection: 'day-definitions',
    limit: 500,
    depth: 0,
  })

  let defsUpdated = 0
  let questionsFixed = 0
  let skippedLinkedForms = 0
  const details: string[] = []

  for (const dd of allDefs.docs as any[]) {
    if (dd.linkedForm) {
      skippedLinkedForms++
      continue
    }

    const questions = dd.questions || []
    if (questions.length === 0) continue

    let changed = false
    const updatedQuestions = questions.map((q: any) => {
      const titleLower = (q.questionTitle || '').toLowerCase()
      const descLower = (q.description || '').toLowerCase()
      const isOptional = q.questionType === 'statement' || titleLower.includes('optional') || descLower.includes('optional')
      const shouldBeRequired = !isOptional

      if (q.required !== shouldBeRequired) {
        changed = true
        questionsFixed++
        details.push(`${dd.blockKey} / ${q.questionId}: required ${q.required} → ${shouldBeRequired}`)
        return { ...q, required: shouldBeRequired }
      }
      return q
    })

    if (changed && !dryRun) {
      await payload.update({
        collection: 'day-definitions',
        id: dd.id,
        data: { questions: updatedQuestions },
      })
      defsUpdated++
    } else if (changed) {
      defsUpdated++
    }
  }

  return NextResponse.json({
    success: true,
    dryRun,
    defsUpdated,
    questionsFixed,
    skippedLinkedForms,
    details: details.slice(0, 50),
    message: dryRun
      ? `[DRY RUN] Would update ${defsUpdated} legacy day definitions, fixing ${questionsFixed} embedded questions. Skipped ${skippedLinkedForms} linked-form-driven records.`
      : `Updated ${defsUpdated} legacy day definitions and fixed ${questionsFixed} embedded questions. Skipped ${skippedLinkedForms} linked-form-driven records.`,
  })
}
