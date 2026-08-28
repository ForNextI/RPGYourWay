import { requireMultiplayerUser, setMultiplayerCharacterClaim } from '@/lib/multiplayer/server'
import { multiplayerErrorResponse } from '@/lib/multiplayer/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request, context: { params: Promise<{ inviteCode: string }> }) {
  try {
    const user = await requireMultiplayerUser()
    const { inviteCode } = await context.params
    const body = await request.json().catch(() => ({})) as { characterId?: unknown; claimed?: unknown }
    const characterId = typeof body.characterId === 'string' ? body.characterId : ''
    const claimed = body.claimed !== false
    const session = await setMultiplayerCharacterClaim(user.id, inviteCode, characterId, claimed)
    return Response.json({ session }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return multiplayerErrorResponse(error)
  }
}
