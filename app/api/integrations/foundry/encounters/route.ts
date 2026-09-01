import { foundryErrorResponse, requireFoundryWebUser } from '@/lib/foundry/server'
import { createFoundryCombatEncounter } from '@/lib/foundry/combat-handoff'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await requireFoundryWebUser()
    const body = await request.json().catch(() => null)
    const encounter = await createFoundryCombatEncounter(user, body)
    return Response.json(encounter, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return foundryErrorResponse(error)
  }
}
