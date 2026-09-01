import { foundryCorsHeaders, foundryErrorResponse } from '@/lib/foundry/server'
import { reportFoundryCombatEncounter } from '@/lib/foundry/combat-handoff'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: foundryCorsHeaders() })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ encounterId: string }> },
) {
  try {
    const { encounterId } = await context.params
    const body = await request.json().catch(() => null)
    const result = await reportFoundryCombatEncounter(request, encounterId, body)
    return Response.json(result, { headers: foundryCorsHeaders() })
  } catch (error) {
    return foundryErrorResponse(error, true)
  }
}
