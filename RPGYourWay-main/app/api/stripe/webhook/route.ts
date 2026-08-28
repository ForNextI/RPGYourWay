import { handleStripeEvent, parseStripeEvent, verifyStripeWebhookSignature } from '@/lib/stripe/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')
  if (!signature) return Response.json({ error: 'Missing Stripe signature.' }, { status: 400 })

  const rawBody = await request.text()
  try {
    verifyStripeWebhookSignature(rawBody, signature)
    const event = parseStripeEvent(rawBody)
    const result = await handleStripeEvent(event)
    return Response.json({ received: true, handled: result.handled })
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Stripe webhook processing failed.'
    console.error('RPG Your Way Stripe webhook failed', message)
    return Response.json({ error: 'Stripe webhook processing failed.' }, { status: 400 })
  }
}
