/**
 * File upload validation for proof submissions (PRD Section 6).
 *
 * Validates MIME types and file sizes server-side.
 * Also exported for client-side use in QuestionRenderer.
 */

export const FILE_LIMITS: Record<string, { maxBytes: number; label: string; proofType: string }> = {
  'application/pdf': {
    maxBytes: 20 * 1024 * 1024, // 20 MB
    label: 'PDF',
    proofType: 'file_pdf',
  },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    maxBytes: 30 * 1024 * 1024, // 30 MB
    label: 'PPTX',
    proofType: 'file_ppt',
  },
  'application/vnd.ms-powerpoint': {
    maxBytes: 30 * 1024 * 1024, // 30 MB
    label: 'PPT',
    proofType: 'file_ppt',
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    maxBytes: 10 * 1024 * 1024, // 10 MB
    label: 'DOCX',
    proofType: 'file_doc',
  },
  'application/msword': {
    maxBytes: 10 * 1024 * 1024, // 10 MB
    label: 'DOC',
    proofType: 'file_doc',
  },
}

/** All accepted MIME types for file_upload questions */
export const ACCEPTED_MIME_TYPES = Object.keys(FILE_LIMITS)

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
}

export function validateFile(file: { name: string; size: number; type: string }): {
  valid: boolean
  error?: string
} {
  const limit = FILE_LIMITS[file.type]

  if (!limit) {
    const accepted = Object.values(FILE_LIMITS).map((l) => l.label).join(', ')
    return { valid: false, error: `Unsupported file type "${file.type}". Accepted: ${accepted}.` }
  }

  if (file.size > limit.maxBytes) {
    return {
      valid: false,
      error: `${limit.label} file exceeds ${formatBytes(limit.maxBytes)} limit (your file: ${formatBytes(file.size)}).`,
    }
  }

  return { valid: true }
}

/** Magic number signatures for server-side file type verification */
const MAGIC_NUMBERS: Array<{ mime: string[]; offset: number; bytes: number[] }> = [
  { mime: ['application/pdf'], offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  {
    mime: [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    offset: 0,
    bytes: [0x50, 0x4B, 0x03, 0x04], // PK (ZIP/OOXML)
  },
  {
    mime: ['application/vnd.ms-powerpoint', 'application/msword'],
    offset: 0,
    bytes: [0xD0, 0xCF, 0x11, 0xE0], // OLE compound document
  },
]

/**
 * Verify that the file's actual bytes match its declared MIME type.
 * Returns false if the magic number doesn't match — indicates MIME spoofing.
 */
export function verifyFileMagicNumber(buffer: Buffer, declaredMime: string): boolean {
  for (const sig of MAGIC_NUMBERS) {
    if (!sig.mime.includes(declaredMime)) continue
    if (buffer.length < sig.offset + sig.bytes.length) return false
    return sig.bytes.every((b, i) => buffer[sig.offset + i] === b)
  }
  // Unknown MIME not in our magic number list — reject by default
  return false
}

export function getProofTypeFromMime(mime: string): string | null {
  return FILE_LIMITS[mime]?.proofType ?? null
}
