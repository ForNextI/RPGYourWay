import { billingErrorResponse, requireUsageAccount } from '@/lib/usage/server-billing'
import { markAudioComplete } from '@/lib/usage/play-turn-billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let account
  try {
    account = await requireUsageAccount()
  } catch (error) {
    return billingErrorResponse(error)
  }

  let body: { turn_id?: unknown; expected_tts_components?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return Response.json({ error: 'The turn-completion request could not be read.' }, { status: 400 })
  }

  const turnId = typeof body.turn_id === 'string' ? body.turn_id.trim() : ''
  const expected = Number(body.expected_tts_components)
  if (!turnId) return Response.json({ error: 'Turn billing id is required.' }, { status: 400 })

  try {
    const settlement = await markAudioComplete(account, turnId, Number.isFinite(expected) ? expected : 0)
    return Response.json({
      settled: settlement.settled,
      pending: settlement.pending,
      billed_microusd: settlement.billedMicrousd,
      balance_microusd: settlement.balanceMicrousd,
      owner_qa_exempt: settlement.ownerQaExempt,
      settlement_warning: settlement.settlementWarning,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'The Play turn could not be finalized.' }, { status: 503 })
  }
}
