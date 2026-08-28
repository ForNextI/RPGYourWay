import { createHmac, timingSafeEqual } from 'node:crypto'

export const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300

function parseStripeSignature(header: string) {
  let timestamp = ''
  const signatures: string[] = []
  for (const piece of header.split(',')) {
    const [key, ...rest] = piece.split('=')
    const value = rest.join('=').trim()
    if (key.trim() === 't') timestamp = value
    if (key.trim() === 'v1' && value) signatures.push(value)
  }
  if (!timestamp || !signatures.length) throw new Error('Stripe signature header is incomplete.')
  return { timestamp, signatures }
}

export function stripeWebhookSignature(rawBody: string, timestamp: string, secret: string) {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex')
}

export function verifyStripeWebhookSignatureWithSecret(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (!secret) throw new Error('Stripe webhook secret is not configured.')
  const { timestamp, signatures } = parseStripeSignature(signatureHeader)
  const timestampNumber = Number(timestamp)
  if (!Number.isFinite(timestampNumber)) throw new Error('Stripe signature timestamp is invalid.')
  if (Math.abs(nowSeconds - timestampNumber) > STRIPE_WEBHOOK_TOLERANCE_SECONDS) throw new Error('Stripe webhook signature is too old.')

  const expected = stripeWebhookSignature(rawBody, timestamp, secret)
  const expectedBytes = Buffer.from(expected, 'utf8')
  const matched = signatures.some((signature) => {
    const suppliedBytes = Buffer.from(signature, 'utf8')
    return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes)
  })
  if (!matched) throw new Error('Stripe webhook signature did not match.')
}
