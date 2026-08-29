import { beginMultiplayerTurn, completeMultiplayerTurn, releaseMultiplayerTurn, requireMultiplayerUser } from '@/lib/multiplayer/server'
import { multiplayerErrorResponse } from '@/lib/multiplayer/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type TurnBody = {
  action?: unknown
  expected_revision?: unknown
  final_revision?: unknown
}

export async function POST(request: Request, context: { params: Promise<{ inviteCode: string; turnId: string }> }) {
  try {
    const user = await requireMultiplayerUser()
    const { inviteCode, turnId } = await context.params
    const body = await request.json().catch(() => ({})) as TurnBody
    const expectedRevision = Number(body.expected_revision)
    if (!Number.isFinite(expectedRevision) || expectedRevision < 1) {
      return Response.json({ error: 'The current cloud campaign revision is required.' }, { status: 400 })
    }
    const turn = await beginMultiplayerTurn(user, inviteCode, turnId, expectedRevision)
    return Response.json({ turn }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return multiplayerErrorResponse(error)
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ inviteCode: string; turnId: string }> }) {
  try {
    const user = await requireMultiplayerUser()
    const { inviteCode, turnId } = await context.params
    const body = await request.json().catch(() => ({})) as TurnBody
    if (body.action === 'release') {
      await releaseMultiplayerTurn(user.id, inviteCode, turnId)
      return Response.json({ released: true }, { headers: { 'Cache-Control': 'no-store' } })
    }
    if (body.action !== 'complete') return Response.json({ error: 'Turn action must be complete or release.' }, { status: 400 })
    const finalRevision = Number(body.final_revision)
    if (!Number.isFinite(finalRevision) || finalRevision < 1) return Response.json({ error: 'The committed cloud revision is required.' }, { status: 400 })
    const session = await completeMultiplayerTurn(user.id, inviteCode, turnId, finalRevision)
    return Response.json({ session }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return multiplayerErrorResponse(error)
  }
}
