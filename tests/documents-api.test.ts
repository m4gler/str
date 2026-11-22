import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.fn()
const findMock = vi.fn()
const findByIDMock = vi.fn()

vi.mock('@/payload.config', () => ({
  default: {},
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({
    auth: authMock,
    find: findMock,
    findByID: findByIDMock,
  })),
}))

import { GET } from '@/app/api/documents/[id]/download/route'

describe('Documents API: download access', () => {
  beforeEach(() => {
    authMock.mockReset()
    findMock.mockReset()
    findByIDMock.mockReset()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns 404 for a partner outside the owner partner scope', async () => {
    authMock.mockResolvedValue({
      user: { id: 20, role: 'partner', partner: 200 },
    })
    findMock.mockImplementation(async ({ collection, where }: { collection: string; where?: Record<string, any> }) => {
      if (collection === 'documents' && where?.downloadToken?.equals === 'private-doc-token') {
        return {
          docs: [
            {
              id: 10,
              downloadToken: 'private-doc-token',
              url: 'https://blob.example.test/private.pdf',
              visibility: 'private',
              owner: 2,
            },
          ],
        }
      }

      return { docs: [] }
    })
    findByIDMock.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'documents') {
        return {
          id: 10,
          url: 'https://blob.example.test/private.pdf',
          visibility: 'private',
          owner: 2,
        }
      }

      if (collection === 'users') {
        return { id: 2, partner: 300 }
      }

      return null
    })

    const response = await GET(
      new Request('http://localhost/api/documents/private-doc-token/download'),
      { params: Promise.resolve({ id: 'private-doc-token' }) },
    )

    expect(response.status).toBe(404)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('streams the document for a partner inside the owner partner scope', async () => {
    authMock.mockResolvedValue({
      user: { id: 20, role: 'partner', partner: 300 },
    })
    findMock.mockImplementation(async ({ collection, where }: { collection: string; where?: Record<string, any> }) => {
      if (collection === 'documents' && where?.downloadToken?.equals === 'private-doc-token') {
        return {
          docs: [
            {
              id: 10,
              downloadToken: 'private-doc-token',
              url: 'https://blob.example.test/private.pdf',
              visibility: 'private',
              owner: 2,
              filename: 'private.pdf',
              mimeType: 'application/pdf',
            },
          ],
        }
      }

      return { docs: [] }
    })
    findByIDMock.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'documents') {
        return {
          id: 10,
          url: 'https://blob.example.test/private.pdf',
          visibility: 'private',
          owner: 2,
          filename: 'private.pdf',
          mimeType: 'application/pdf',
        }
      }

      if (collection === 'users') {
        return { id: 2, partner: 300 }
      }

      return null
    })
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(
      new Response('pdf-body', {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
      }),
    )

    const response = await GET(
      new Request('http://localhost/api/documents/private-doc-token/download'),
      { params: Promise.resolve({ id: 'private-doc-token' }) },
    )

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith('https://blob.example.test/private.pdf', {
      cache: 'no-store',
      headers: expect.any(Headers),
    })
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
  })

  it('resolves internal document file URLs against the current app origin', async () => {
    authMock.mockResolvedValue({ user: null })
    findMock.mockImplementation(async ({ collection, where }: { collection: string; where?: Record<string, any> }) => {
      if (collection === 'documents' && where?.downloadToken?.equals === 'privacy-doc-token') {
        return {
          docs: [
            {
              id: 10,
              downloadToken: 'privacy-doc-token',
              url: '/api/documents/file/privacy.pdf',
              visibility: 'public',
              filename: 'privacy.pdf',
              mimeType: 'application/pdf',
            },
          ],
        }
      }

      return { docs: [] }
    })
    findByIDMock.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'documents') {
        return {
          id: 10,
          url: '/api/documents/file/privacy.pdf',
          visibility: 'public',
          filename: 'privacy.pdf',
          mimeType: 'application/pdf',
        }
      }

      return null
    })

    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(
      new Response('pdf-body', {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
      }),
    )

    const response = await GET(
      new Request('http://localhost/api/documents/privacy-doc-token/download', {
        headers: { cookie: 'payload-token=test-token' },
      }),
      { params: Promise.resolve({ id: 'privacy-doc-token' }) },
    )

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith('http://localhost/api/documents/file/privacy.pdf', {
      cache: 'no-store',
      headers: expect.any(Headers),
    })

    const forwardedHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Headers
    expect(forwardedHeaders.get('cookie')).toBe('payload-token=test-token')
  })

  it('keeps legacy numeric document paths working for already-stored submission links', async () => {
    authMock.mockResolvedValue({ user: null })
    findMock.mockResolvedValue({ docs: [] })
    findByIDMock.mockImplementation(async ({ collection, id }: { collection: string; id: string | number }) => {
      if (collection === 'documents' && String(id) === '10') {
        return {
          id: 10,
          url: 'https://blob.example.test/public.pdf',
          visibility: 'public',
          filename: 'public.pdf',
          mimeType: 'application/pdf',
        }
      }

      return null
    })

    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(
      new Response('pdf-body', {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
      }),
    )

    const response = await GET(
      new Request('http://localhost/api/documents/10/download'),
      { params: Promise.resolve({ id: '10' }) },
    )

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith('https://blob.example.test/public.pdf', {
      cache: 'no-store',
      headers: expect.any(Headers),
    })
  })
})
