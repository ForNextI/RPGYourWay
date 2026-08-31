import { createAdminClient } from '@/lib/supabase/admin'
import {
  FoundryIntegrationError,
  foundryCorsHeaders,
  foundryErrorResponse,
  requireFoundrySession,
} from '@/lib/foundry/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function plainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function cleanId(value: unknown, label: string, maxLength = 180) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new FoundryIntegrationError(`${label} is required.`, 400, 'invalid_foundry_state')
  return text.slice(0, maxLength)
}

function cleanOptionalId(value: unknown, maxLength = 180) {
  if (value === null || value === undefined) return null
  return cleanId(value, 'Foundry source user ID', maxLength)
}

function finiteCoordinate(value: unknown, label: string) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) {
    throw new FoundryIntegrationError(`${label} is not valid.`, 400, 'invalid_foundry_state')
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

    if (
      !plainObject(body)
      || body.version !== 1
      || body.kind !== 'token-position'
    ) {
      throw new FoundryIntegrationError(
        'The Foundry state update is not supported.',
        400,
        'invalid_foundry_state',
      )
    }

    const eventId = cleanId(body.eventId, 'State event ID')
    if (!UUID_PATTERN.test(eventId)) {
      throw new FoundryIntegrationError('State event ID is not valid.', 400, 'invalid_foundry_state')
    }

    const sessionId = cleanId(body.sessionId, 'Multiplayer session ID')
    const campaignCharacterId = cleanId(body.campaignCharacterId, 'Campaign character ID')
    const foundryActorId = cleanId(body.foundryActorId, 'Foundry Actor ID')
    const foundryTokenId = cleanId(body.foundryTokenId, 'Foundry token ID')
    const sceneId = cleanId(body.sceneId, 'Foundry scene ID')
    const sourceFoundryUserId = cleanOptionalId(body.sourceFoundryUserId)
    const x = finiteCoordinate(body.x, 'Token x')
    const y = finiteCoordinate(body.y, 'Token y')

    const admin = createAdminClient()

    const { data: session, error: sessionError } = await admin
      .from('multiplayer_sessions')
      .select('id, expires_at')
      .eq('id', sessionId)
      .eq('campaign_id', campaign.id)
      .neq('status', 'closed')
      .maybeSingle()

    if (sessionError) throw new FoundryIntegrationError(sessionError.message, 503, 'database_unavailable')
    if (
      !session
      || (session.expires_at && Date.parse(session.expires_at) <= Date.now())
    ) {
      throw new FoundryIntegrationError(
        'The RPG Your Way multiplayer table is no longer active.',
        409,
        'multiplayer_session_changed',
      )
    }

    const { data: character, error: characterError } = await admin
      .from('multiplayer_session_characters')
      .select('character_id, display_name')
      .eq('session_id', sessionId)
      .eq('character_id', campaignCharacterId)
      .maybeSingle()

    if (characterError) throw new FoundryIntegrationError(characterError.message, 503, 'database_unavailable')
    if (!character) {
      throw new FoundryIntegrationError(
        'That character is not in the current RPG Your Way multiplayer table.',
        404,
        'campaign_character_not_found',
      )
    }

    const { data: mapping, error: mappingError } = await admin
      .from('foundry_character_mappings')
      .select('foundry_actor_id')
      .eq('connection_id', connection.id)
      .eq('campaign_character_id', campaignCharacterId)
      .maybeSingle()

    if (mappingError) throw new FoundryIntegrationError(mappingError.message, 503, 'database_unavailable')
    if (!mapping || mapping.foundry_actor_id !== foundryActorId) {
      throw new FoundryIntegrationError(
        'The Foundry Actor does not match the saved RPG Your Way character mapping.',
        409,
        'foundry_character_mapping_mismatch',
      )
    }

    const now = new Date().toISOString()
    const { error: stateError } = await admin
      .from('foundry_token_state')
      .upsert({
        connection_id: connection.id,
        campaign_id: campaign.id,
        session_id: sessionId,
        campaign_character_id: campaignCharacterId,
        foundry_actor_id: foundryActorId,
        foundry_token_id: foundryTokenId,
        scene_id: sceneId,
        x,
        y,
        source_foundry_user_id: sourceFoundryUserId,
        last_event_id: eventId,
        updated_at: now,
      }, { onConflict: 'connection_id,campaign_character_id' })

    if (stateError) throw new FoundryIntegrationError(stateError.message, 503, 'database_unavailable')

    return Response.json({
      accepted: true,
      eventId,
      campaignCharacterId,
      characterName: character.display_name || 'Character',
      foundryActorId,
      foundryTokenId,
      sceneId,
      x,
      y,
    }, { headers: foundryCorsHeaders() })
  } catch (error) {
    return foundryErrorResponse(error, true)
  }
}
