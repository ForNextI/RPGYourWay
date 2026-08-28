import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { createAblyTokenRequest, multiplayerCapabilityForTest } from '../lib/multiplayer/ably-token.ts'

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

console.log('RPG Your Way multiplayer Phase 1 checks passed: room-scoped capability and signed Ably TokenRequest.')
