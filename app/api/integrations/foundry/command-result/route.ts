import {
  FoundryIntegrationError,
  foundryCorsHeaders,
  foundryErrorResponse,
  requireFoundrySession,
} from '@/lib/foundry/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function plainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function requiredString(value: unknown, label: string) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new FoundryIntegrationError(`${label} is required.`, 400, 'invalid_command_result')
  return text.slice(0, 180)
}

function finiteCoordinate(value: unknown, label: string) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) {
    throw new FoundryIntegrationError(`${label} is not valid.`, 400, 'invalid_command_result')
  }
  return number
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: foundryCorsHeaders() })
}

export async function POST(request: Request) {
  try {
    const { connection, campaign } = await requireFoundrySession(request)
    const body = await request.json().catch(() => null)

    if (!plainObject(body) || body.version !== 1) {
      throw new FoundryIntegrationError('The Foundry command result is not valid.', 400, 'invalid_command_result')
    }

    const status = body.status === 'applied' || body.status === 'duplicate'
      ? body.status
      : null

    if (!status) {
      throw new FoundryIntegrationError('The Foundry command result status is not supported.', 400, 'invalid_command_result')
    }

    return Response.json({
      accepted: true,
      connectionId: connection.id,
      campaignId: campaign.id,
      commandId: requiredString(body.commandId, 'Command ID'),
      status,
      sceneId: requiredString(body.sceneId, 'Scene ID'),
      tokenId: requiredString(body.tokenId, 'Token ID'),
      x: finiteCoordinate(body.x, 'Token x'),
      y: finiteCoordinate(body.y, 'Token y'),
    }, { headers: foundryCorsHeaders() })
  } catch (error) {
    return foundryErrorResponse(error, true)
  }
}
