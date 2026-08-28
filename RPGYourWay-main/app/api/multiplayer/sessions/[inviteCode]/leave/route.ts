import { leaveMultiplayerSession, requireMultiplayerUser } from '@/lib/multiplayer/server'
import { multiplayerErrorResponse } from '@/lib/multiplayer/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_request: Request, context: { params: Promise<{ inviteCode: string }> }) {
  try {
    const user = await requireMultiplayerUser()
    const { inviteCode } = await context.params
    const result = await leaveMultiplayerSession(user.id, inviteCode)
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return multiplayerErrorResponse(error)
  }
}
