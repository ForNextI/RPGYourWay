import { foundryErrorResponse, requireFoundryWebUser } from '@/lib/foundry/server'
import { getFoundryCombatEncounterStatus } from '@/lib/foundry/combat-handoff'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  context: { params: Promise<{ encounterId: string }> },
) {
  try {
    const user = await requireFoundryWebUser()
    const { encounterId } = await context.params
    const status = await getFoundryCombatEncounterStatus(user, encounterId)
    return Response.json(status, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return foundryErrorResponse(error)
  }
}
