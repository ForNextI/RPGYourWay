import { createHmac, randomBytes } from 'node:crypto'

export type SignedAblyTokenRequest = {
  keyName: string
  ttl: number
  capability: string
  clientId: string
  timestamp: number
  nonce: string
  mac: string
}

function canonicalCapability(sessionId: string) {
  const resources: Record<string, string[]> = {
    [`rpg-mp:${sessionId}:chat`]: ['history', 'publish', 'subscribe'],
    [`rpg-mp:${sessionId}:game`]: ['subscribe'],
    [`rpg-mp:${sessionId}:presence`]: ['presence', 'subscribe'],
  }
  return JSON.stringify(Object.fromEntries(
    Object.entries(resources)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([resource, operations]) => [resource, [...operations].sort()]),
  ))
}

export function createAblyTokenRequest(input: { apiKey: string; sessionId: string; clientId: string; now?: number; ttl?: number }): SignedAblyTokenRequest {
  const separator = input.apiKey.indexOf(':')
  if (separator <= 0 || separator === input.apiKey.length - 1) {
    throw new Error('ABLY_API_KEY is not configured correctly.')
  }
  const keyName = input.apiKey.slice(0, separator)
  const keySecret = input.apiKey.slice(separator + 1)
  const ttl = Math.max(60_000, Math.min(60 * 60 * 1000, Math.trunc(input.ttl ?? 15 * 60 * 1000)))
  const timestamp = Math.trunc(input.now ?? Date.now())
  const nonce = randomBytes(20).toString('hex')
  const capability = canonicalCapability(input.sessionId)
  const signText = [keyName, String(ttl), capability, input.clientId, String(timestamp), nonce, ''].join('\n')
  const mac = createHmac('sha256', keySecret).update(signText, 'utf8').digest('base64')
  return { keyName, ttl, capability, clientId: input.clientId, timestamp, nonce, mac }
}

export function multiplayerCapabilityForTest(sessionId: string) {
  return canonicalCapability(sessionId)
}

export type AblyTokenDetails = {
  token: string
  keyName?: string
  issued?: number
  expires?: number
  capability?: string
  clientId?: string
}

function ablyErrorMessage(payload: unknown, status: number) {
  if (!payload || typeof payload !== 'object') return `Ably authorization failed with HTTP ${status}.`
  const row = payload as { message?: unknown; code?: unknown; error?: unknown }
  const nested = row.error && typeof row.error === 'object' ? row.error as { message?: unknown; code?: unknown } : null
  const message = typeof row.message === 'string' ? row.message : typeof nested?.message === 'string' ? nested.message : ''
  const code = Number.isFinite(Number(row.code)) ? Number(row.code) : Number.isFinite(Number(nested?.code)) ? Number(nested?.code) : 0
  return `${message || `Ably authorization failed with HTTP ${status}.`}${code ? ` (Ably ${code})` : ''}`
}

export async function requestAblyTokenDetails(
  input: { apiKey: string; sessionId: string; clientId: string; now?: number; ttl?: number },
  fetchImpl: typeof fetch = fetch,
): Promise<AblyTokenDetails> {
  const request = createAblyTokenRequest(input)
  let response: Response
  try {
    response = await fetchImpl(`https://main.realtime.ably.net/keys/${encodeURIComponent(request.keyName)}/requestToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (error) {
    throw new Error(error instanceof Error
      ? `RPG Your Way could not reach Ably to authorize multiplayer realtime: ${error.message}`
      : 'RPG Your Way could not reach Ably to authorize multiplayer realtime.')
  }

  const payload = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) throw new Error(ablyErrorMessage(payload, response.status))
  if (typeof payload.token !== 'string' || !payload.token) throw new Error('Ably authorized the request but did not return a usable realtime token.')
  return payload as AblyTokenDetails
}
