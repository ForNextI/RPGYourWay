import {
  foundryCorsHeaders,
  foundryErrorResponse,
  refreshFoundryDeviceSession,
} from '@/lib/foundry/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: foundryCorsHeaders() })
}

export async function POST(request: Request) {
  try {
    const result = await refreshFoundryDeviceSession(request)
    return Response.json(result, { headers: foundryCorsHeaders() })
  } catch (error) {
    return foundryErrorResponse(error, true)
  }
}
