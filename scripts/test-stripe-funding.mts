import assert from 'node:assert/strict'
import {
  PLAY_PACKS,
  formatPurchasePrice,
  includedProcessingCents,
  nominalUsageMicrousd,
  playPackById,
} from '../lib/billing/play-packs.ts'
import { stripeWebhookSignature, verifyStripeWebhookSignatureWithSecret } from '../lib/stripe/signature.ts'
import fs from 'node:fs'

assert.equal(PLAY_PACKS.length, 6)
const expected = [
  ['starter', 600, 500, 50],
  ['occasional', 1690, 1500, 105],
  ['regular', 3340, 3000, 210],
  ['frequent', 4990, 4500, 315],
  ['extended', 7200, 6500, 455],
  ['marathon', 9950, 9000, 630],
] as const
for (const [id, price, usage, operating] of expected) {
  const pack = playPackById(id)
  assert.ok(pack)
  assert.equal(pack.priceCents, price)
  assert.equal(pack.usageCents, usage)
  assert.equal(pack.siteOperatingCents, operating)
  assert.equal(nominalUsageMicrousd(pack), usage * 10_000)
  const standardStripeFee = Math.round(price * 0.029 + 30)
  assert.ok(includedProcessingCents(pack) >= standardStripeFee, `${id} must cover the standard domestic-card processing assumption.`)
}
assert.equal(playPackById('bogus'), null)
assert.equal(formatPurchasePrice(600), '$6.00')
assert.equal(formatPurchasePrice(1690), '$16.90')

const checkoutSource = fs.readFileSync(new URL('../lib/stripe/checkout.ts', import.meta.url), 'utf8')
assert.match(checkoutSource, /from ['"]\.\.\/billing\/play-packs['"]/)
assert.doesNotMatch(checkoutSource, /from ['"]\.\.\/billing\/play-packs\.ts['"]/)
assert.match(checkoutSource, /processing-surplus/)
assert.match(checkoutSource, /session\.amount_total !== pack\.priceCents/)
assert.match(checkoutSource, /session\.payment_status !== 'paid'/)

const serverSource = fs.readFileSync(new URL('../lib/stripe/server.ts', import.meta.url), 'utf8')
assert.match(serverSource, /latest_charge\.balance_transaction/)
assert.match(serverSource, /actualProcessingFeeCents/)
assert.match(serverSource, /processingSurplusCents/)
assert.match(serverSource, /rpgyw_credit_usage/)

const body = JSON.stringify({ id: 'evt_test', type: 'checkout.session.completed' })
const secret = 'whsec_test_secret'
const timestamp = '1787620000'
const signature = stripeWebhookSignature(body, timestamp, secret)
verifyStripeWebhookSignatureWithSecret(body, `t=${timestamp},v1=${signature}`, secret, Number(timestamp))
assert.throws(() => verifyStripeWebhookSignatureWithSecret(body, `t=${timestamp},v1=deadbeef`, secret, Number(timestamp)), /did not match/)

console.log('RPG Your Way Stripe funding sanity checks passed: retail prices, usable balances, fee coverage, surplus-credit wiring, and webhook signatures.')
