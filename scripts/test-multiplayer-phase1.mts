import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { createAblyTokenRequest, multiplayerCapabilityForTest, requestAblyTokenDetails } from '../lib/multiplayer/ably-token.ts'

const sessionId = '11111111-2222-4333-8444-555555555555'
const capability = multiplayerCapabilityForTest(sessionId)
const parsed = JSON.parse(capability) as Record<string, string[]>
assert.deepEqual(Object.keys(parsed), [
  `rpg-mp:${sessionId}:chat`,
  `rpg-mp:${sessionId}:game`,
  `rpg-mp:${sessionId}:presence`,
])
assert.deepEqual(parsed[`rpg-mp:${sessionId}:chat`], ['history', 'publish', 'subscribe'])
assert.deepEqual(parsed[`rpg-mp:${sessionId}:game`], ['subscribe'])
assert.deepEqual(parsed[`rpg-mp:${sessionId}:presence`], ['presence', 'subscribe'])
assert.equal(capability.includes('"*"'), false)

const request = createAblyTokenRequest({
  apiKey: 'app.key:super-secret',
  sessionId,
  clientId: 'rpg-seat:seat-1:room:' + sessionId,
  now: 1_800_000_000_000,
  ttl: 2_700_000,
})
const signText = [request.keyName, String(request.ttl), request.capability, request.clientId, String(request.timestamp), request.nonce, ''].join('\n')
const expectedMac = createHmac('sha256', 'super-secret').update(signText, 'utf8').digest('base64')
assert.equal(request.mac, expectedMac)
assert.equal(request.timestamp, 1_800_000_000_000)
assert.equal(request.ttl, 2_700_000)
assert.ok(request.nonce.length >= 16)
assert.throws(() => createAblyTokenRequest({ apiKey: 'bad-key', sessionId, clientId: 'x' }), /ABLY_API_KEY/)



let exchangedBody: Record<string, unknown> | null = null
const tokenDetails = await requestAblyTokenDetails({
  apiKey: 'app.key:super-secret',
  sessionId,
  clientId: 'rpg-seat:seat-1:room:' + sessionId,
  now: 1_800_000_000_000,
}, async (_input, init) => {
  exchangedBody = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>
  return new Response(JSON.stringify({
    token: 'ably-token-value',
    keyName: 'app.key',
    capability,
    clientId: 'rpg-seat:seat-1:room:' + sessionId,
    issued: 1_800_000_000_000,
    expires: 1_800_000_900_000,
  }), { status: 201, headers: { 'Content-Type': 'application/json' } })
})
assert.equal(tokenDetails.token, 'ably-token-value')
assert.equal(exchangedBody?.keyName, 'app.key')
assert.equal(typeof exchangedBody?.mac, 'string')
await assert.rejects(
  requestAblyTokenDetails({ apiKey: 'app.key:super-secret', sessionId, clientId: 'x' }, async () => new Response(JSON.stringify({ message: 'Key lacks required capability', code: 40160 }), { status: 401 })),
  /Key lacks required capability.*Ably 40160/,
)

console.log('RPG Your Way multiplayer Phase 1 checks passed: room-scoped capability and signed Ably TokenRequest.')
