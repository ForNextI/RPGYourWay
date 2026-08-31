import { foundryErrorResponse, listUserFoundryConnections, requireFoundryWebUser } from '@/lib/foundry/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireFoundryWebUser()
    const connections = await listUserFoundryConnections(user.id)
    return Response.json({ connections }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return foundryErrorResponse(error)
  }
}
