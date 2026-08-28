import { createAblyTokenRequest } from '@/lib/multiplayer/ably-token'
import { loadSessionByInvite, realtimeClientId, requireMultiplayerUser } from '@/lib/multiplayer/server'
import { multiplayerErrorResponse, MultiplayerError } from '@/lib/multiplayer/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await requireMultiplayerUser()
    const body = await request.json().catch(() => ({})) as { inviteCode?: unknown }
    const inviteCode = typeof body.inviteCode === 'string' ? body.inviteCode : ''
    const session = await loadSessionByInvite(inviteCode, user.id)
    if (!session.selfSeatId) throw new MultiplayerError('Join this multiplayer table before connecting to realtime.', 403, 'membership_required')
    const apiKey = process.env.ABLY_API_KEY || ''
    if (!/^[^:]+:.+$/.test(apiKey)) throw new MultiplayerError('Multiplayer realtime is not configured yet.', 503, 'ably_not_configured')
    const tokenRequest = createAblyTokenRequest({
      apiKey,
      sessionId: session.id,
      clientId: realtimeClientId(session.selfSeatId, session.id),
    })
    return Response.json(tokenRequest, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return multiplayerErrorResponse(error)
  }
}
