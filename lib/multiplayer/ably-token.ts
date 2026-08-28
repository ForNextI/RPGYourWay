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
