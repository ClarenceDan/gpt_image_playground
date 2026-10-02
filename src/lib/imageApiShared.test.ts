import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchImageBlobViaProxy, fetchImageUrlAsDataUrl } from './imageApiShared'

const CORS_BLOCKED_URL = 'https://cdn.example.com/img.png'

function imageResponse(type = 'image/png') {
  return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': type } })
}

function htmlResponse() {
  return new Response('<!doctype html><html></html>', { status: 200, headers: { 'content-type': 'text/html' } })
}

const opaqueResponse = { type: 'opaque' } as unknown as Response

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchImageUrlAsDataUrl', () => {
  it('fetches the url directly when the provider allows it', async () => {
    const fetchMock = vi.fn(async () => imageResponse())
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchImageUrlAsDataUrl(CORS_BLOCKED_URL, 'image/png')

    expect(result).toBe('data:image/png;base64,AQID')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to the same-origin proxy when direct fetch is blocked by cors', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith('/api/image-proxy')) return imageResponse()
      throw new TypeError('Failed to fetch')
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchImageUrlAsDataUrl(CORS_BLOCKED_URL, 'image/png')

    expect(result).toBe('data:image/png;base64,AQID')
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/image-proxy?url=${encodeURIComponent(CORS_BLOCKED_URL)}`,
      expect.objectContaining({ cache: 'no-store' }),
    )
  })

  it('keeps the original cors error when the proxy is unavailable (static deployment returns html)', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.startsWith('/api/image-proxy')) return htmlResponse()
      if (init?.mode === 'no-cors') return opaqueResponse
      throw new TypeError('Failed to fetch')
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchImageUrlAsDataUrl(CORS_BLOCKED_URL, 'image/png')).rejects.toThrow('服务商未允许跨域')
  })
})

describe('fetchImageBlobViaProxy', () => {
  it('returns null for non-http urls without issuing a request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    expect(await fetchImageBlobViaProxy('img-123')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null when the proxy responds with an error status', async () => {
    const fetchMock = vi.fn(async () => new Response('Forbidden', { status: 403, headers: { 'content-type': 'text/plain' } }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await fetchImageBlobViaProxy(CORS_BLOCKED_URL)).toBeNull()
  })
})
