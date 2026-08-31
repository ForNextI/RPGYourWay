import {
  FoundryIntegrationError,
  foundryCorsHeaders,
  foundryErrorResponse,
  requireFoundrySession,
} from '@/lib/foundry/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ProbeState = {
  version: 1
  scene: {
    id: string
    width: number
    height: number
    gridSize: number
  }
  token: {
    id: string
    name: string
    x: number
    y: number
    width: number
    height: number
    hidden: boolean
    disposition: number
  }
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function requiredString(value: unknown, label: string, maxLength = 180) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new FoundryIntegrationError(`${label} is required.`, 400, 'invalid_probe_state')
  return text.slice(0, maxLength)
}

function finiteNumber(value: unknown, label: string) {
  const number = Number(value)
  if (!Number.isFinite(number)) throw new FoundryIntegrationError(`${label} is not valid.`, 400, 'invalid_probe_state')
  return number
}

function parseProbeState(value: unknown): ProbeState {
  if (!plainObject(value) || value.version !== 1) {
    throw new FoundryIntegrationError('The Foundry probe state is not valid.', 400, 'invalid_probe_state')
  }

  if (!plainObject(value.scene) || !plainObject(value.token)) {
    throw new FoundryIntegrationError('The Foundry probe state is incomplete.', 400, 'invalid_probe_state')
  }

  const sceneWidth = finiteNumber(value.scene.width, 'Scene width')
  const sceneHeight = finiteNumber(value.scene.height, 'Scene height')
  const gridSize = finiteNumber(value.scene.gridSize, 'Grid size')
  const tokenX = finiteNumber(value.token.x, 'Token x')
  const tokenY = finiteNumber(value.token.y, 'Token y')
  const tokenWidth = finiteNumber(value.token.width, 'Token width')
  const tokenHeight = finiteNumber(value.token.height, 'Token height')

  if (
    sceneWidth <= 0
    || sceneHeight <= 0
    || gridSize <= 0
    || tokenX < 0
    || tokenY < 0
    || tokenWidth <= 0
    || tokenHeight <= 0
  ) {
    throw new FoundryIntegrationError('The Foundry probe geometry is not valid.', 400, 'invalid_probe_state')
  }

  return {
    version: 1,
    scene: {
      id: requiredString(value.scene.id, 'Scene ID'),
      width: sceneWidth,
      height: sceneHeight,
      gridSize,
    },
    token: {
      id: requiredString(value.token.id, 'Token ID'),
      name: requiredString(value.token.name, 'Token name', 160),
      x: tokenX,
      y: tokenY,
      width: tokenWidth,
      height: tokenHeight,
      hidden: Boolean(value.token.hidden),
      disposition: finiteNumber(value.token.disposition, 'Token disposition'),
    },
  }
}

function nextProbePosition(state: ProbeState) {
  const { scene, token } = state
  const maxX = Math.max(0, scene.width - (token.width * scene.gridSize))
  const maxY = Math.max(0, scene.height - (token.height * scene.gridSize))

  const candidates = [
    { x: token.x + scene.gridSize, y: token.y },
    { x: token.x, y: token.y + scene.gridSize },
    { x: token.x - scene.gridSize, y: token.y },
    { x: token.x, y: token.y - scene.gridSize },
  ]

  const next = candidates.find(({ x, y }) => (
    x >= 0 && y >= 0 && x <= maxX && y <= maxY
  ))

  if (!next) {
    throw new FoundryIntegrationError(
      'The selected token has no valid one-grid-space probe move.',
      409,
      'probe_move_unavailable',
    )
  }

  return next
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: foundryCorsHeaders() })
}

export async function POST(request: Request) {
  try {
    const { connection, campaign } = await requireFoundrySession(request)
    const body = await request.json().catch(() => null)

    if (!plainObject(body) || body.version !== 1 || body.kind !== 'gm-action-probe') {
      throw new FoundryIntegrationError('The Foundry turn request is not supported.', 400, 'unsupported_foundry_turn')
    }

    const operationId = requiredString(body.operationId, 'Operation ID')
    const state = parseProbeState(body.state)
    const next = nextProbePosition(state)

    return Response.json({
      version: 1,
      kind: 'gm-action-probe',
      connectionId: connection.id,
      campaignId: campaign.id,
      commands: [{
        version: 1,
        commandId: operationId,
        type: 'token.move',
        sceneId: state.scene.id,
        tokenId: state.token.id,
        x: next.x,
        y: next.y,
      }],
    }, { headers: foundryCorsHeaders() })
  } catch (error) {
    return foundryErrorResponse(error, true)
  }
}
