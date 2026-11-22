import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { headers as getHeaders } from 'next/headers'
import config from '@/payload.config'
import { CURRICULUM_SOURCE_DEFAULT_PATH } from '@/lib/curriculum/constants'
import { syncCurriculumRelease, type SyncScope } from '@/lib/curriculum/admin'

const MAX_UPLOAD_SIZE = 50 * 1024 * 1024 // 50 MB

export async function POST(request: NextRequest) {
  // Auth check FIRST — before processing any uploads
  const payload = await getPayload({ config })
  const hdrs = await getHeaders()

  const { user } = await payload.auth({ headers: hdrs })
  if (!user || (user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const contentType = request.headers.get('content-type') || ''
  let body: Record<string, unknown> = {}

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: 'File too large (max 50 MB)' }, { status: 400 })
    }

    const fs = await import('fs')
    const path = await import('path')
    const buffer = Buffer.from(await file.arrayBuffer())
    const destPath = path.join(process.cwd(), CURRICULUM_SOURCE_DEFAULT_PATH)
    fs.writeFileSync(destPath, buffer)
    body = { scope: 'all', refreshSnapshot: true, writeMarkdown: true, activateRelease: true }
  } else {
    body = await request.json().catch(() => ({}))
  }

  try {
    const result = await syncCurriculumRelease(payload, {
      scope: (body.scope || 'all') as SyncScope,
      filePath: body.filePath as string | undefined,
      refreshSnapshot: body.refreshSnapshot === true,
      writeMarkdown: body.writeMarkdown !== false,
      activateRelease: body.activateRelease !== false,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Curriculum sync failed' },
      { status: 500 },
    )
  }
}
