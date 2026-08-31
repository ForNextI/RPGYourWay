import {
  foundryCorsHeaders,
  foundryErrorResponse,
} from '@/lib/foundry/server'
import {
  runFoundryAigmTurn,
} from '@/lib/foundry/aigm-turn'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: foundryCorsHeaders(),
  })
}

export async function POST(request: Request) {
  try {
    const result = await runFoundryAigmTurn(request)
    return Response.json(
      result,
      { headers: foundryCorsHeaders() },
    )
  } catch (error) {
    return foundryErrorResponse(error, true)
  }
}
