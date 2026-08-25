const requestHistory = new Map<string, number[]>()

function clientKey(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
}

/**
 * Best-effort in-memory rate limiting. It protects warm server instances and
 * accidental request floods. A shared durable limiter can replace it when the
 * public service grows beyond the prototype stage.
 */
export function isRateLimited(
  request: Request,
  bucket: string,
  limit: number,
  windowMs: number,
) {
  const key = `${bucket}:${clientKey(request)}`
  const now = Date.now()
  const recent = (requestHistory.get(key) ?? []).filter((time) => now - time < windowMs)
  if (recent.length >= limit) return true
  recent.push(now)
  requestHistory.set(key, recent)
  return false
}
