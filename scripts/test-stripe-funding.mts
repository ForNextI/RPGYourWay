import assert from 'node:assert/strict'
import { PLAY_PACKS, formatPurchasePrice, playPackById } from '../lib/billing/play-packs.ts'
import { stripeWebhookSignature, verifyStripeWebhookSignatureWithSecret } from '../lib/stripe/signature.ts'
import fs from 'node:fs'

assert.equal(PLAY_PACKS.length, 6)
assert.equal(playPackById('starter')?.priceCents, 500)
assert.equal(playPackById('starter')?.allowanceMicrousd, 4_250_000)
assert.equal(playPackById('occasional')?.allowanceMicrousd, 13_500_000)
assert.equal(playPackById('regular')?.allowanceMicrousd, 27_000_000)
assert.equal(playPackById('frequent')?.allowanceMicrousd, 40_500_000)
assert.equal(playPackById('extended')?.allowanceMicrousd, 58_500_000)
assert.equal(playPackById('marathon')?.allowanceMicrousd, 81_000_000)
assert.equal(playPackById('bogus'), null)
assert.equal(formatPurchasePrice(500), '$5')
assert.equal(formatPurchasePrice(1500), '$15')


const checkoutSource = fs.readFileSync(new URL('../lib/stripe/checkout.ts', import.meta.url), 'utf8')
assert.match(checkoutSource, /from ['"]\.\.\/billing\/play-packs['"]/)
assert.doesNotMatch(checkoutSource, /from ['"]\.\.\/billing\/play-packs\.ts['"]/)
assert.match(checkoutSource, /return `stripe:checkout:\$\{sessionId\}`/)
assert.match(checkoutSource, /session\.amount_total !== pack\.priceCents/)
assert.match(checkoutSource, /session\.payment_status !== 'paid'/)
assert.match(checkoutSource, /expectedUserId && userId !== expectedUserId/)

const body = JSON.stringify({ id: 'evt_test', type: 'checkout.session.completed' })
const secret = 'whsec_test_secret'
const timestamp = '1787620000'
const signature = stripeWebhookSignature(body, timestamp, secret)
verifyStripeWebhookSignatureWithSecret(body, `t=${timestamp},v1=${signature}`, secret, Number(timestamp))
assert.throws(
  () => verifyStripeWebhookSignatureWithSecret(body, `t=${timestamp},v1=deadbeef`, secret, Number(timestamp)),
  /did not match/,
)
assert.throws(
  () => verifyStripeWebhookSignatureWithSecret(body, `t=${timestamp},v1=${signature}`, secret, Number(timestamp) + 301),
  /too old/,
)

console.log('RPG Your Way Stripe funding sanity checks passed: pack amounts, checkout source guards, and webhook signature verification.')
