import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import ExcelJS from 'exceljs'

/** Sanitize cell values to prevent Excel formula injection */
function sanitizeCell(value: unknown): unknown {
  if (typeof value !== 'string') return value
  // Prefix dangerous leading characters that Excel interprets as formulas
  if (/^[=+\-@\t\r]/.test(value)) return `'${value}`
  return value
}

export async function GET(request: NextRequest) {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user || (user.role !== 'admin' && user.role !== 'partner')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const partnerIdParam = url.searchParams.get('partnerId')
    const trackFilter = url.searchParams.get('track')
    const archetypeFilter = url.searchParams.get('archetype')
    const programStatusFilter = url.searchParams.get('programStatus')
    const submissionStatusFilter = url.searchParams.get('submissionStatus')
    const userIdsParam = url.searchParams.get('userIds')

    // Determine which partner to export for
    // Security: partners can ONLY export their own users — partnerId param is ignored
    let partnerId: string | number | null = null
    if (user.role === 'admin') {
        if (!partnerIdParam) {
            return NextResponse.json({ error: 'partnerId is required for admin' }, { status: 400 })
        }
        partnerId = partnerIdParam
    } else {
        // Partner role: always use the partner from the user record, never from query params
        partnerId = (user as any).partner?.id ?? (user as any).partner
        if (!partnerId) {
            return NextResponse.json({ error: 'No partner assigned' }, { status: 400 })
        }
    }

    // Verify the partner actually exists
    const partnerExists = await payload.findByID({ collection: 'partners', id: partnerId, depth: 0 }).catch(() => null)
    if (!partnerExists) {
        return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
    }

    const partnerDoc = await payload.findByID({ collection: 'partners', id: partnerId, depth: 0 }).catch(() => null) as any
    const partnerName = partnerDoc?.name || 'Partner'

    // Fetch users linked to this partner
    const userWhere: any = { partner: { equals: partnerId }, role: { equals: 'founder' } }
    if (programStatusFilter && programStatusFilter !== 'all') {
        userWhere.programStatus = { equals: programStatusFilter }
    }
    const usersResult = await payload.find({
        collection: 'users',
        where: userWhere,
        depth: 0,
        limit: 1000,
        overrideAccess: true,
    })
    let users = usersResult.docs as any[]

    if (userIdsParam) {
        const selectedIds = new Set(userIdsParam.split(',').map(id => id.trim()))
        users = users.filter(u => selectedIds.has(String(u.id)))
    }

    if (users.length === 0) {
        return NextResponse.json({ error: 'No founders found matching filters' }, { status: 404 })
    }

    const userIds = users.map(u => u.id)

    // Fetch project submissions
    const orConditions = userIds.map((uid: number) => ({ user: { equals: uid } }))
    const projResult = await payload.find({
        collection: 'project-submissions',
        where: { or: orConditions } as any,
        depth: 2,
        limit: 1000,
        overrideAccess: true,
    })

    let submissions = projResult.docs as any[]

    if (trackFilter && trackFilter !== 'all') {
        submissions = submissions.filter(s => {
            const trackDoc = typeof s.track === 'object' ? s.track : null
            return trackDoc?.slug === trackFilter || String(s.track) === trackFilter
        })
    }

    if (submissionStatusFilter && submissionStatusFilter !== 'all') {
        submissions = submissions.filter(s => s.status === submissionStatusFilter)
    }

    // Fetch archetype data from personality tests
    const settings = await payload.findGlobal({ slug: 'platform-settings' }).catch(() => ({})) as any
    const ptFormRef = settings?.activePersonalityTestForm
    const ptFormId = ptFormRef ? (typeof ptFormRef === 'object' ? ptFormRef?.id : ptFormRef) : null

    const ptByUser: Record<number, any> = {}
    if (ptFormId) {
        const ptOrConditions = userIds.map((uid: number) => ({ user: { equals: uid } }))
        const ptResult = await payload.find({
            collection: 'founder-form-submissions',
            where: { and: [{ form: { equals: ptFormId } }, { or: ptOrConditions }] } as any,
            depth: 0,
            limit: 1000,
            overrideAccess: true,
        })
        for (const sub of ptResult.docs as any[]) {
            const uid = typeof sub.user === 'object' ? sub.user?.id : sub.user
            if (uid && !ptByUser[uid]) ptByUser[uid] = sub
        }
    }

    // Filter by archetype
    let filteredUserIds = new Set(userIds.map(Number))
    if (archetypeFilter && archetypeFilter !== 'all') {
        filteredUserIds = new Set<number>()
        for (const uid of userIds) {
            if (ptByUser[uid]?.archetype === archetypeFilter) filteredUserIds.add(Number(uid))
        }
    }

    // Index submissions by user
    const subByUser: Record<number, any> = {}
    for (const s of submissions) {
        const uid = typeof s.user === 'object' ? s.user?.id : s.user
        if (!subByUser[uid]) subByUser[uid] = s
    }

    // Parse structured description
    function parseDesc(desc: string) {
        const r: Record<string, string> = {}
        for (const line of desc.split('\n')) {
            const i = line.indexOf(': ')
            if (i === -1) continue
            const k = line.slice(0, i).trim().toLowerCase()
            const v = line.slice(i + 2).trim()
            if (v) r[k] = v
        }
        return r
    }

    function statusLabel(s: string) {
        if (s === 'approved') return 'Accept'
        if (s === 'denied') return 'Deny'
        return 'Pending'
    }

    // Build rows
    type Row = {
        subId: number | string; userId: number; email: string; progStatus: string;
        archetype: string; track: string; name: string; oneliner: string; problem: string;
        solution: string; targetUser: string; industry: string; path: string; stage: string;
        website: string; fullDesc: string; curStatus: string; comment: string; createdAt: string;
        decision: string;
    }
    const dataRows: Row[] = []

    for (const u of users) {
        if (!filteredUserIds.has(Number(u.id))) continue
        const sub = subByUser[u.id]
        if (!sub) continue // skip users without submissions

        const pt = ptByUser[u.id]
        const p = sub.projectDescription ? parseDesc(sub.projectDescription) : {}
        const td = sub.track && typeof sub.track === 'object' ? sub.track : null

        dataRows.push({
            subId: sub.id,
            userId: u.id,
            email: u.email,
            progStatus: u.programStatus || 'not_started',
            archetype: pt?.archetype ?? '',
            track: td?.name ?? '',
            name: p['name'] ?? '',
            oneliner: p['one-liner'] ?? '',
            problem: p['problem'] ?? '',
            solution: p['solution'] ?? '',
            targetUser: p['target user'] ?? '',
            industry: p['industry'] ?? '',
            path: p['path'] ?? '',
            stage: p['stage'] ?? '',
            website: p['website'] ?? '',
            fullDesc: sub.projectDescription ?? '',
            curStatus: sub.status ?? 'pending',
            comment: sub.partnerComment ?? '',
            createdAt: sub.createdAt ? new Date(sub.createdAt).toISOString().split('T')[0] : '',
            decision: statusLabel(sub.status),
        })
    }

    if (dataRows.length === 0) {
        return NextResponse.json({ error: 'No founders matched the selected filters' }, { status: 404 })
    }

    // Build Excel with ExcelJS
    const wb = new ExcelJS.Workbook()
    wb.creator = 'MESGA'
    wb.created = new Date()

    // ─── Submissions sheet ───
    const ws = wb.addWorksheet('Submissions')

    const headers = [
        'Submission ID', 'User ID', 'Email', 'Program Status', 'Archetype', 'Track',
        'Project Name', 'One-Liner', 'Problem', 'Solution', 'Target User', 'Industry',
        'Path', 'Stage', 'Website', 'Full Description', 'Current Status', 'Partner Comment',
        'Created At', 'Decision', 'Review Comment',
    ]
    const colWidths = [14, 8, 30, 14, 18, 16, 25, 40, 35, 35, 20, 16, 14, 14, 25, 60, 14, 30, 12, 14, 30]

    // Header row
    const headerRow = ws.addRow(headers)
    headerRow.font = { bold: true, size: 10 }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B2B2F' } }
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    headers.forEach((_, i) => {
        ws.getColumn(i + 1).width = colWidths[i]
    })

    // Decision column index (1-based)
    const decisionCol = headers.indexOf('Decision') + 1 // = 20
    const reviewCommentCol = headers.indexOf('Review Comment') + 1 // = 21

    // Data rows
    for (let i = 0; i < dataRows.length; i++) {
        const d = dataRows[i]
        const row = ws.addRow([
            d.subId, d.userId, d.email, d.progStatus, d.archetype, d.track,
            d.name, d.oneliner, d.problem, d.solution, d.targetUser, d.industry,
            d.path, d.stage, d.website, d.fullDesc, d.curStatus, d.comment,
            d.createdAt, d.decision, '',
        ].map(sanitizeCell))

        // Light alternating row colors
        if (i % 2 === 0) {
            row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F8F8' } }
        }

        // Apply dropdown validation to Decision cell
        const decisionCell = row.getCell(decisionCol)
        decisionCell.dataValidation = {
            type: 'list',
            allowBlank: false,
            formulae: ['"Pending,Accept,Deny"'],
            showErrorMessage: true,
            errorTitle: 'Invalid',
            error: 'Please select Pending, Accept, or Deny',
        }

        // Color the decision cell based on value
        if (d.decision === 'Accept') {
            decisionCell.font = { color: { argb: 'FF2CB1A1' }, bold: true }
        } else if (d.decision === 'Deny') {
            decisionCell.font = { color: { argb: 'FFC96A4A' }, bold: true }
        }

        // Lock non-editable columns (everything except Decision and Review Comment)
        for (let c = 1; c <= headers.length; c++) {
            if (c !== decisionCol && c !== reviewCommentCol) {
                row.getCell(c).protection = { locked: true }
            }
        }
    }

    // Protect the sheet but allow editing Decision + Review Comment columns
    ws.protect('', {
        selectLockedCells: true,
        selectUnlockedCells: true,
        formatCells: false,
        formatColumns: false,
        formatRows: false,
    })
    // Unlock the Decision and Review Comment columns
    for (let r = 2; r <= dataRows.length + 1; r++) {
        ws.getCell(r, decisionCol).protection = { locked: false }
        ws.getCell(r, reviewCommentCol).protection = { locked: false }
    }

    // ─── Instructions sheet ───
    const instrWs = wb.addWorksheet('Instructions')
    instrWs.getColumn(1).width = 70
    const instructions = [
        'HOW TO USE THIS FILE',
        '',
        '1. Review each founder\'s project in the "Submissions" sheet',
        '2. In the "Decision" column, use the dropdown: Pending, Accept, or Deny',
        '3. Optionally add a comment in the "Review Comment" column',
        '4. Save the file and upload it back in the Partner Dashboard',
        '',
        'IMPORTANT: Do not modify Submission ID or User ID columns',
        'Only rows where Decision changes from "Pending" will be processed',
        '"Pending" rows are skipped on import (no change)',
    ]
    instructions.forEach((text, i) => {
        const row = instrWs.addRow([text])
        if (i === 0) row.font = { bold: true, size: 14 }
    })

    // Write to buffer
    const buffer = await wb.xlsx.writeBuffer()

    const safeName = partnerName.replace(/[^a-zA-Z0-9]/g, '_')
    const date = new Date().toISOString().split('T')[0]
    const filename = `${safeName}_submissions_${date}.xlsx`

    return new NextResponse(buffer, {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    })
}
