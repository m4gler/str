import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import * as XLSX from 'xlsx'

function normalizeDecision(raw: string): 'approved' | 'denied' | 'pending' | null {
    const val = raw.trim().toLowerCase()
    if (val === 'accept' || val === 'approved') return 'approved'
    if (val === 'deny' || val === 'denied') return 'denied'
    if (val === 'pending') return 'pending'
    return null
}

export async function POST(request: NextRequest) {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user || (user.role !== 'admin' && user.role !== 'partner')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    const sheetName = workbook.SheetNames.find(n => n === 'Submissions') || workbook.SheetNames[0]
    const ws = workbook.Sheets[sheetName]
    if (!ws) {
        return NextResponse.json({ error: 'No valid sheet found' }, { status: 400 })
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws)

    // Collect all submission IDs from the Excel to validate in one query
    const requestedSubIds: (string | number)[] = []
    for (const row of rows) {
        const subId = row['Submission ID']
        const rawDecision = String(row['Decision'] ?? row['Decision (approved/denied)'] ?? '').trim()
        const decision = normalizeDecision(rawDecision)
        if (subId && decision && decision !== 'pending') {
            requestedSubIds.push(subId)
        }
    }

    if (requestedSubIds.length === 0) {
        return NextResponse.json({ processed: 0, skipped: rows.length, errors: [], total: rows.length })
    }

    // ─── Security: build an allow-list of submission IDs this user can modify ───
    // For partners: fetch all submissions belonging to their users (via user.partner)
    // For admins: all requested IDs are allowed
    const allowedSubIds = new Set<string>()

    if (user.role === 'partner') {
        const partnerId = (user as any).partner?.id ?? (user as any).partner
        if (!partnerId) {
            return NextResponse.json({ error: 'No partner assigned' }, { status: 400 })
        }

        // Get all founder user IDs for this partner
        const partnerUsers = await payload.find({
            collection: 'users',
            where: { partner: { equals: partnerId }, role: { equals: 'founder' } },
            depth: 0,
            limit: 1000,
            overrideAccess: true,
        })
        const partnerUserIds = new Set((partnerUsers.docs as any[]).map(u => u.id))

        if (partnerUserIds.size === 0) {
            return NextResponse.json({ error: 'No founders linked to your partner' }, { status: 400 })
        }

        // Fetch all project submissions for partner's users
        const orConds = Array.from(partnerUserIds).map(uid => ({ user: { equals: uid } }))
        const partnerSubs = await payload.find({
            collection: 'project-submissions',
            where: { or: orConds } as any,
            depth: 0,
            limit: 2000,
            overrideAccess: true,
        })
        for (const s of partnerSubs.docs) {
            allowedSubIds.add(String(s.id))
        }
    } else {
        // Admin: allow all
        for (const id of requestedSubIds) {
            allowedSubIds.add(String(id))
        }
    }

    // ─── Process rows ───
    const results: { submissionId: string | number; decision: string; success: boolean; error?: string }[] = []
    let processed = 0
    let skipped = 0

    // Pre-fetch all submissions we'll update (batch instead of N+1)
    const idsToFetch = requestedSubIds.filter(id => allowedSubIds.has(String(id)))
    const subsMap = new Map<string, any>()
    if (idsToFetch.length > 0) {
        const fetchOrConds = idsToFetch.map(id => ({ id: { equals: id } }))
        const fetchResult = await payload.find({
            collection: 'project-submissions',
            where: { or: fetchOrConds } as any,
            depth: 0,
            limit: 2000,
            overrideAccess: true,
        })
        for (const doc of fetchResult.docs) {
            subsMap.set(String(doc.id), doc)
        }
    }

    for (const row of rows) {
        const submissionId = row['Submission ID']
        const rawDecision = String(row['Decision'] ?? row['Decision (approved/denied)'] ?? '').trim()
        const comment = String(row['Review Comment'] ?? '').trim()

        if (!submissionId) {
            skipped++
            continue
        }

        const decision = normalizeDecision(rawDecision)

        if (!decision || decision === 'pending') {
            skipped++
            continue
        }

        // Security: check against allow-list
        if (!allowedSubIds.has(String(submissionId))) {
            results.push({
                submissionId,
                decision: rawDecision,
                success: false,
                error: 'Access denied — this submission does not belong to your partner',
            })
            continue
        }

        const sub = subsMap.get(String(submissionId))
        if (!sub) {
            results.push({ submissionId, decision: rawDecision, success: false, error: 'Submission not found' })
            continue
        }

        // Skip if nothing changed
        if (sub.status === decision && !comment) {
            skipped++
            continue
        }

        try {
            await payload.update({
                collection: 'project-submissions',
                id: submissionId,
                data: {
                    status: decision,
                    partnerComment: comment || sub.partnerComment || '',
                    reviewedBy: user.id,
                    reviewedAt: new Date().toISOString(),
                },
                overrideAccess: true,
            })

            processed++
            results.push({ submissionId, decision: rawDecision, success: true })
        } catch (err: any) {
            results.push({ submissionId, decision: rawDecision, success: false, error: err?.message || 'Unknown error' })
        }
    }

    return NextResponse.json({
        processed,
        skipped,
        errors: results.filter(r => !r.success),
        total: rows.length,
    })
}
