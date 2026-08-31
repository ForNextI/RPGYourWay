import { approveFoundryPlayerLink, foundryErrorResponse, requireFoundryWebUser } from '@/lib/foundry/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await requireFoundryWebUser()
    const body = await request.json().catch(() => ({})) as { code?: unknown }
    const result = await approveFoundryPlayerLink(user, body.code)
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return foundryErrorResponse(error)
  }
}
