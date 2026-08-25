import { verifyStripeWebhookSignatureWithSecret } from '@/lib/stripe/signature'
import type { PlayPack } from '@/lib/billing/play-packs'
import { stripeCheckoutCreditIdempotencyKey, validatePaidCheckoutSession, type StripeCheckoutSession } from '@/lib/stripe/checkout'
import { createAdminClient } from '@/lib/supabase/admin'

const STRIPE_API_BASE = 'https://api.stripe.com/v1'

type StripeEvent = {
  id: string
  type: string
  data?: {
    object?: StripeCheckoutSession
  }
}

function requiredEnv(name: 'STRIPE_SECRET_KEY' | 'STRIPE_WEBHOOK_SECRET') {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not configured.`)
  return value
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.rpgyourway.com').replace(/\/$/, '')
}

async function stripeRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${requiredEnv('STRIPE_SECRET_KEY')}`)
  if (init.body) headers.set('Content-Type', 'application/x-www-form-urlencoded')

  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) {
    const nested = payload.error && typeof payload.error === 'object' ? payload.error as Record<string, unknown> : null
    const detail = typeof nested?.message === 'string' ? nested.message : `Stripe returned HTTP ${response.status}.`
    throw new Error(detail)
  }
  return payload
}

export async function createPlayPackCheckoutSession(args: {
  userId: string
  email?: string | null
  pack: PlayPack
}) {
  const { userId, email, pack } = args
  const body = new URLSearchParams()
  body.set('mode', 'payment')
  body.set('success_url', `${siteUrl()}/account?status=payment-success&session_id={CHECKOUT_SESSION_ID}`)
  body.set('cancel_url', `${siteUrl()}/pricing?status=checkout-cancelled`)
  body.set('client_reference_id', userId)
  if (email) body.set('customer_email', email)
  body.set('line_items[0][quantity]', '1')
  body.set('line_items[0][price_data][currency]', 'usd')
  body.set('line_items[0][price_data][unit_amount]', String(pack.priceCents))
  body.set('line_items[0][price_data][product_data][name]', pack.name)
  body.set('line_items[0][price_data][product_data][description]', 'Prepaid RPG Your Way usage balance')
  body.set('metadata[play_pack_id]', pack.id)
  body.set('metadata[user_id]', userId)
  body.set('payment_intent_data[metadata][play_pack_id]', pack.id)
  body.set('payment_intent_data[metadata][user_id]', userId)

  const payload = await stripeRequest('/checkout/sessions', { method: 'POST', body })
  const session = payload as unknown as StripeCheckoutSession
  if (!session.id || !session.url) throw new Error('Stripe did not return a usable Checkout Session.')
  return session
}

export async function retrieveCheckoutSession(sessionId: string) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) throw new Error('Invalid Stripe Checkout Session identifier.')
  return await stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`) as unknown as StripeCheckoutSession
}


export async function creditPaidCheckoutSession(session: StripeCheckoutSession, expectedUserId?: string) {
  const validated = validatePaidCheckoutSession(session, expectedUserId)
  if (!validated.paid) return { credited: false as const, pending: true as const }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('rpgyw_credit_usage', {
    p_user_id: validated.userId,
    p_amount_microusd: validated.pack.allowanceMicrousd,
    p_source: 'stripe',
    p_source_ref: session.id,
    p_idempotency_key: stripeCheckoutCreditIdempotencyKey(session.id),
    p_metadata: {
      play_pack_id: validated.pack.id,
      play_pack_name: validated.pack.name,
      purchase_price_cents: validated.pack.priceCents,
      allowance_microusd: validated.pack.allowanceMicrousd,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent || null,
      stripe_customer_id: session.customer || null,
    },
  })

  if (error) throw new Error(`RPG Your Way could not credit the paid Play Pack: ${error.message}`)
  return { credited: true as const, pending: false as const, balanceMicrousd: data, pack: validated.pack }
}

export async function finalizeCheckoutSessionById(sessionId: string, expectedUserId?: string) {
  const session = await retrieveCheckoutSession(sessionId)
  return creditPaidCheckoutSession(session, expectedUserId)
}

export function verifyStripeWebhookSignature(rawBody: string, signatureHeader: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  verifyStripeWebhookSignatureWithSecret(rawBody, signatureHeader, requiredEnv('STRIPE_WEBHOOK_SECRET'), nowSeconds)
}

export function parseStripeEvent(rawBody: string): StripeEvent {
  const parsed = JSON.parse(rawBody) as StripeEvent
  if (!parsed || typeof parsed.id !== 'string' || typeof parsed.type !== 'string') throw new Error('Stripe webhook event is malformed.')
  return parsed
}

export async function handleStripeEvent(event: StripeEvent) {
  if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') {
    return { handled: false as const }
  }
  const session = event.data?.object
  if (!session || session.object !== 'checkout.session') throw new Error('Stripe webhook did not contain a Checkout Session.')
  const result = await creditPaidCheckoutSession(session)
  return { handled: true as const, result }
}
