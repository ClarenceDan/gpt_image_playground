// Vercel Edge Function：同源图片下载代理。
// 前端直连图片 URL 被服务商 CORS 拦截时，经部署自身转发获取。
// 静态部署（GitHub Pages / Docker / Cloudflare）没有此接口，前端检测到非图片响应会自动回退原有错误提示。

export const config = { runtime: 'edge' }

const MAX_IMAGE_BYTES = 100 * 1024 * 1024
const FETCH_TIMEOUT_MS = 60_000

function plainResponse(status: number, message: string) {
  return new Response(message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** 拒绝内网 / 回环 / 链路本地 / 保留地址，降低被当作开放代理的 SSRF 风险 */
function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home.arpa')) {
    return true
  }

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const a = Number(ipv4[1])
    const b = Number(ipv4[2])
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true
    if (a >= 224) return true
  }

  if (host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) return true
  return false
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') return plainResponse(405, 'Method Not Allowed')

  // 阻止其他网站在浏览器里滥用本代理；非浏览器客户端没有该请求头，靠下方内容类型限制兜底
  if (request.headers.get('sec-fetch-site') === 'cross-site') return plainResponse(403, 'Forbidden')

  const target = new URL(request.url).searchParams.get('url')
  if (!target) return plainResponse(400, 'Missing url parameter')

  let parsedTarget: URL
  try {
    parsedTarget = new URL(target)
  } catch {
    return plainResponse(400, 'Invalid url parameter')
  }
  if (parsedTarget.protocol !== 'http:' && parsedTarget.protocol !== 'https:') {
    return plainResponse(400, 'Unsupported url protocol')
  }
  if (isBlockedHostname(parsedTarget.hostname)) return plainResponse(403, 'Forbidden hostname')

  let upstream: Response
  try {
    upstream = await fetch(parsedTarget.toString(), {
      headers: { accept: 'image/*,*/*;q=0.8' },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch {
    return plainResponse(502, 'Upstream fetch failed')
  }
  if (!upstream.ok) return plainResponse(502, `Upstream responded HTTP ${upstream.status}`)

  // 重定向可能落到内网地址，对最终地址再校验一次
  try {
    if (isBlockedHostname(new URL(upstream.url).hostname)) return plainResponse(403, 'Forbidden hostname')
  } catch {
    return plainResponse(502, 'Invalid upstream url')
  }

  const contentType = (upstream.headers.get('content-type') ?? '').toLowerCase()
  if (!(contentType.startsWith('image/') || contentType.includes('octet-stream'))) {
    return plainResponse(415, 'Upstream did not return an image')
  }

  const declaredLength = Number(upstream.headers.get('content-length') ?? '')
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) return plainResponse(413, 'Image too large')

  if (!upstream.body) return plainResponse(502, 'Empty upstream body')

  // 流式转发并在超限时中断，避免无 content-length 的响应绕过大小限制
  const reader = upstream.body.getReader()
  let received = 0
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) {
        controller.close()
        return
      }
      received += value.byteLength
      if (received > MAX_IMAGE_BYTES) {
        void reader.cancel()
        controller.error(new Error('Image too large'))
        return
      }
      controller.enqueue(value)
    },
    cancel() {
      void reader.cancel()
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': 'no-store',
    },
  })
}
