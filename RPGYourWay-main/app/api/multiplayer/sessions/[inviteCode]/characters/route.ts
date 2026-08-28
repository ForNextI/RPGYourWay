import { requireMultiplayerUser, syncMultiplayerCharacters } from '@/lib/multiplayer/server'
import { multiplayerErrorResponse } from '@/lib/multiplayer/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request, context: { params: Promise<{ inviteCode: string }> }) {
  try {
    const user = await requireMultiplayerUser()
    const { inviteCode } = await context.params
    const body = await request.json().catch(() => ({})) as { characters?: unknown }
    const characters = Array.isArray(body.characters)
      ? body.characters.map((entry) => {
          const value = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {}
          return {
            characterId: typeof value.characterId === 'string' ? value.characterId : '',
            displayName: typeof value.displayName === 'string' ? value.displayName : '',
          }
        })
      : []
    const session = await syncMultiplayerCharacters(user.id, inviteCode, characters)
    return Response.json({ session }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return multiplayerErrorResponse(error)
  }
}
