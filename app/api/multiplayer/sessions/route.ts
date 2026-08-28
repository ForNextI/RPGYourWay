import { createMultiplayerSession, requireMultiplayerUser } from '@/lib/multiplayer/server'
import { multiplayerErrorResponse } from '@/lib/multiplayer/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CreateBody = {
  localCampaignId?: unknown
  campaignName?: unknown
  characters?: unknown
}

export async function POST(request: Request) {
  try {
    const user = await requireMultiplayerUser()
    const body = await request.json().catch(() => ({})) as CreateBody
    const characters = Array.isArray(body.characters)
      ? body.characters.map((entry) => {
          const value = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {}
          return {
            characterId: typeof value.characterId === 'string' ? value.characterId : '',
            displayName: typeof value.displayName === 'string' ? value.displayName : '',
          }
        })
      : []
    const session = await createMultiplayerSession(user, {
      localCampaignId: typeof body.localCampaignId === 'string' ? body.localCampaignId : '',
      campaignName: typeof body.campaignName === 'string' ? body.campaignName : '',
      characters,
    })
    return Response.json({ session }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return multiplayerErrorResponse(error)
  }
}
