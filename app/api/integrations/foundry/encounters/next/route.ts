import { foundryCorsHeaders, foundryErrorResponse } from '@/lib/foundry/server'
import { claimFoundryCombatEncounter } from '@/lib/foundry/combat-handoff'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: foundryCorsHeaders() })
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const result = await claimFoundryCombatEncounter(request, body)
    return Response.json(result, { headers: foundryCorsHeaders() })
  } catch (error) {
    return foundryErrorResponse(error, true)
  }
}
