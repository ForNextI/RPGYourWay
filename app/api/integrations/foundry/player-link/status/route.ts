import { foundryCorsHeaders, foundryErrorResponse, getFoundryPlayerLinkStatus } from '@/lib/foundry/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: foundryCorsHeaders() })
}

export async function GET(request: Request) {
  try {
    const pairId = new URL(request.url).searchParams.get('pairId')
    const result = await getFoundryPlayerLinkStatus(pairId)
    return Response.json(result, { headers: foundryCorsHeaders() })
  } catch (error) {
    return foundryErrorResponse(error, true)
  }
}
