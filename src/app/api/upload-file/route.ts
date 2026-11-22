import { getPayload } from 'payload'
import config from '@/payload.config'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { validateFile, getProofTypeFromMime, verifyFileMagicNumber } from '@/lib/fileValidation'
import { getDocumentDownloadLocator, getDocumentDownloadPath } from '@/lib/documents'

/**
 * POST /api/upload-file
 *
 * Validates and uploads a file for form submissions (PRD Section 6).
 * Uses Payload's Media collection (Vercel Blob storage).
 *
 * Accepts: multipart/form-data with a single "file" field.
 * Returns: { url, proofType, mediaId } on success.
 * Auth: requires authenticated user.
 */
export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const headersObj = await headers()
  const { user } = await payload.auth({ headers: headersObj })

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const formData = await request.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Validate MIME type and size
  const validation = validateFile({ name: file.name, size: file.size, type: file.type })
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  try {
    // Upload via Payload Documents collection (accepts PDFs, PPTX, DOCX)
    const buffer = Buffer.from(await file.arrayBuffer())

    // Server-side magic number verification to prevent MIME spoofing
    if (!verifyFileMagicNumber(buffer, file.type)) {
      return NextResponse.json({ error: 'File content does not match its declared type' }, { status: 400 })
    }

    const doc = await payload.create({
      collection: 'documents',
      data: {
        title: `Form upload: ${file.name}`,
        visibility: 'private',
        owner: user.id,
      } as any,
      file: {
        data: buffer,
        mimetype: file.type,
        name: file.name,
        size: file.size,
      },
      overrideAccess: true,
    })

    const url = getDocumentDownloadPath(doc)
    const proofType = getProofTypeFromMime(file.type) || 'text'

    return NextResponse.json({
      url,
      proofType,
      documentId: doc.id,
      documentLocator: getDocumentDownloadLocator(doc),
      fileName: file.name,
    })
  } catch (err) {
    console.error('[upload-file] Failed:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
