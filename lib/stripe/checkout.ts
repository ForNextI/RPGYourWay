import { playPackById } from '../billing/play-packs'

export type StripeCheckoutSession = {
  id: string
  object?: string
  mode?: string | null
  payment_status?: string | null
  amount_total?: number | null
  currency?: string | null
  client_reference_id?: string | null
  customer?: string | null
  payment_intent?: string | null
  metadata?: Record<string, string> | null
  url?: string | null
}

export function stripeCheckoutCreditIdempotencyKey(sessionId: string) {
  return `stripe:checkout:${sessionId}`
}

export function validatePaidCheckoutSession(session: StripeCheckoutSession, expectedUserId?: string) {
  if (!session.id) throw new Error('Stripe Checkout Session is missing an id.')
  if (session.mode !== 'payment') throw new Error('Stripe Checkout Session is not a one-time payment.')
  if (session.payment_status !== 'paid') return { paid: false as const }

  const pack = playPackById(session.metadata?.play_pack_id)
  if (!pack) throw new Error('Stripe Checkout Session references an unknown Play Pack.')
  if (session.currency !== 'usd') throw new Error('Stripe Checkout Session currency does not match the Play Pack.')
  if (session.amount_total !== pack.priceCents) throw new Error('Stripe Checkout Session amount does not match the Play Pack.')

  const userId = session.client_reference_id || session.metadata?.user_id || ''
  if (!userId) throw new Error('Stripe Checkout Session is missing the RPG Your Way account reference.')
  if (expectedUserId && userId !== expectedUserId) throw new Error('This Stripe Checkout Session belongs to another RPG Your Way account.')

  return { paid: true as const, pack, userId }
}
