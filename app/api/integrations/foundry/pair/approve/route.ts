import { approveFoundryPairing, foundryErrorResponse, requireFoundryWebUser } from '@/lib/foundry/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await requireFoundryWebUser()
    const body = await request.json().catch(() => ({})) as { code?: unknown; campaign_id?: unknown }
    const result = await approveFoundryPairing(user, body.code, body.campaign_id)
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return foundryErrorResponse(error)
  }
}
