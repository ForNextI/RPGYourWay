import { requireMultiplayerUser, updateMultiplayerDisplayName } from '@/lib/multiplayer/server'
import { multiplayerErrorResponse } from '@/lib/multiplayer/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request, context: { params: Promise<{ inviteCode: string }> }) {
  try {
    const user = await requireMultiplayerUser()
    const { inviteCode } = await context.params
    const body = await request.json().catch(() => ({})) as { displayName?: unknown }
    const session = await updateMultiplayerDisplayName(user.id, inviteCode, body.displayName)
    return Response.json({ session }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return multiplayerErrorResponse(error)
  }
}
