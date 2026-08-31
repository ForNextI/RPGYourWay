import { createAdminClient } from '@/lib/supabase/admin'
import {
  FoundryIntegrationError,
  foundryCorsHeaders,
  foundryErrorResponse,
  requireFoundrySession,
} from '@/lib/foundry/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type LiveSessionRow = {
  id: string
  expires_at: string | null
}

type SeatRow = {
  id: string
  user_id: string
  display_name: string
}

type CharacterRow = {
  character_id: string
  display_name: string
  ordinal: number
}

type ClaimRow = {
  seat_id: string
  character_id: string
}

type LinkRow = {
  rpg_user_id: string
  foundry_user_id: string
}

type MappingRow = {
  campaign_character_id: string
  foundry_actor_id: string
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function cleanId(value: unknown, label: string, maxLength = 180) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new FoundryIntegrationError(`${label} is required.`, 400, 'invalid_foundry_mapping')
  return text.slice(0, maxLength)
}

async function requireLiveMultiplayerSession(campaignId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('multiplayer_sessions')
    .select('id, expires_at')
    .eq('campaign_id', campaignId)
    .neq('status', 'closed')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) throw new FoundryIntegrationError(error.message, 503, 'database_unavailable')

  const now = Date.now()
  const session = ((data ?? []) as LiveSessionRow[]).find(
    (row) => !row.expires_at || Date.parse(row.expires_at) > now,
  )

  if (!session) {
    throw new FoundryIntegrationError(
      'The connected campaign does not currently have a live multiplayer table.',
      409,
      'multiplayer_session_required',
    )
  }

  return session
}

async function loadRoster(connectionId: string, campaignId: string, sessionId: string) {
  const admin = createAdminClient()

  const [
    { data: seatData, error: seatError },
    { data: characterData, error: characterError },
    { data: claimData, error: claimError },
    { data: linkData, error: linkError },
    { data: mappingData, error: mappingError },
  ] = await Promise.all([
    admin
      .from('multiplayer_seats')
      .select('id, user_id, display_name')
      .eq('session_id', sessionId)
      .eq('is_active', true)
      .order('joined_at', { ascending: true }),
    admin
      .from('multiplayer_session_characters')
      .select('character_id, display_name, ordinal')
      .eq('session_id', sessionId)
      .order('ordinal', { ascending: true }),
    admin
      .from('multiplayer_character_claims')
      .select('seat_id, character_id')
      .eq('session_id', sessionId),
    admin
      .from('foundry_user_links')
      .select('rpg_user_id, foundry_user_id')
      .eq('connection_id', connectionId)
      .eq('status', 'active'),
    admin
      .from('foundry_character_mappings')
      .select('campaign_character_id, foundry_actor_id')
      .eq('connection_id', connectionId),
  ])

  const failure = seatError || characterError || claimError || linkError || mappingError
  if (failure) throw new FoundryIntegrationError(failure.message, 503, 'database_unavailable')

  const seats = (seatData ?? []) as SeatRow[]
  const characters = (characterData ?? []) as CharacterRow[]
  const claims = (claimData ?? []) as ClaimRow[]
  const links = (linkData ?? []) as LinkRow[]
  const mappings = (mappingData ?? []) as MappingRow[]

  const activeSeatIds = new Set(seats.map((seat) => seat.id))
  const linkIdsByRpgUser = new Map<string, Set<string>>()

  for (const link of links) {
    const current = linkIdsByRpgUser.get(link.rpg_user_id) ?? new Set<string>()
    current.add(link.foundry_user_id)
    linkIdsByRpgUser.set(link.rpg_user_id, current)
  }

  const resolveFoundryUser = (rpgUserId: string) => {
    const ids = [...(linkIdsByRpgUser.get(rpgUserId) ?? [])]
    return ids.length === 1 ? ids[0] : null
  }

  const claimsByCharacter = new Map<string, string[]>()
  for (const claim of claims) {
    if (!activeSeatIds.has(claim.seat_id)) continue
    const current = claimsByCharacter.get(claim.character_id) ?? []
    current.push(claim.seat_id)
    claimsByCharacter.set(claim.character_id, current)
  }

  const actorByCharacter = new Map(
    mappings.map((row) => [row.campaign_character_id, row.foundry_actor_id]),
  )

  return {
    version: 1 as const,
    sessionId,
    revision: Date.now(),
    participants: seats.map((seat) => ({
      participantId: seat.id,
      displayName: seat.display_name || 'Player',
      foundryUserId: resolveFoundryUser(seat.user_id),
      // Deliberately unknown. Connection state and character control are not
      // attendance or billing proxies.
      attendance: 'unknown' as const,
    })),
    characters: characters.map((character) => ({
      campaignCharacterId: character.character_id,
      displayName: character.display_name || 'Character',
      foundryActorId: actorByCharacter.get(character.character_id) ?? null,
      controllerParticipantIds: claimsByCharacter.get(character.character_id) ?? [],
    })),
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: foundryCorsHeaders() })
}

export async function GET(request: Request) {
  try {
    const { connection, campaign } = await requireFoundrySession(request)
    if (campaign.mode !== 'multiplayer') {
      throw new FoundryIntegrationError(
        'The 0.2.5 Foundry roster bridge currently requires a multiplayer campaign.',
        409,
        'multiplayer_campaign_required',
      )
    }

    const session = await requireLiveMultiplayerSession(campaign.id as string)
    const roster = await loadRoster(connection.id as string, campaign.id as string, session.id)
    return Response.json(roster, { headers: foundryCorsHeaders() })
  } catch (error) {
    return foundryErrorResponse(error, true)
  }
}

export async function POST(request: Request) {
  try {
    const { connection, campaign } = await requireFoundrySession(request)
    if (campaign.mode !== 'multiplayer') {
      throw new FoundryIntegrationError(
        'The 0.2.5 Foundry roster bridge currently requires a multiplayer campaign.',
        409,
        'multiplayer_campaign_required',
      )
    }

    const session = await requireLiveMultiplayerSession(campaign.id as string)
    const body = await request.json().catch(() => null)

    if (!plainObject(body) || body.version !== 1) {
      throw new FoundryIntegrationError(
        'The Foundry character mapping request is not valid.',
        400,
        'invalid_foundry_mapping',
      )
    }

    const campaignCharacterId = cleanId(body.campaignCharacterId, 'Campaign character ID')
    const admin = createAdminClient()

    const { data: character, error: characterError } = await admin
      .from('multiplayer_session_characters')
      .select('character_id')
      .eq('session_id', session.id)
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

    if (body.foundryActorId === null) {
      const { error: mappingDeleteError } = await admin
        .from('foundry_character_mappings')
        .delete()
        .eq('connection_id', connection.id)
        .eq('campaign_character_id', campaignCharacterId)

      if (mappingDeleteError) throw new FoundryIntegrationError(mappingDeleteError.message, 503, 'database_unavailable')

      const { error: stateDeleteError } = await admin
        .from('foundry_token_state')
        .delete()
        .eq('connection_id', connection.id)
        .eq('campaign_character_id', campaignCharacterId)

      if (stateDeleteError) throw new FoundryIntegrationError(stateDeleteError.message, 503, 'database_unavailable')

      return Response.json(
        { mapped: false, campaignCharacterId },
        { headers: foundryCorsHeaders() },
      )
    }

    const foundryActorId = cleanId(body.foundryActorId, 'Foundry Actor ID')

    const { data: conflict, error: conflictError } = await admin
      .from('foundry_character_mappings')
      .select('campaign_character_id')
      .eq('connection_id', connection.id)
      .eq('foundry_actor_id', foundryActorId)
      .neq('campaign_character_id', campaignCharacterId)
      .maybeSingle()

    if (conflictError) throw new FoundryIntegrationError(conflictError.message, 503, 'database_unavailable')
    if (conflict) {
      throw new FoundryIntegrationError(
        'That Foundry Actor is already mapped to another RPG Your Way character.',
        409,
        'foundry_actor_already_mapped',
      )
    }

    const now = new Date().toISOString()
    const { error: mappingError } = await admin
      .from('foundry_character_mappings')
      .upsert({
        connection_id: connection.id,
        campaign_id: campaign.id,
        campaign_character_id: campaignCharacterId,
        foundry_actor_id: foundryActorId,
        mapped_by_foundry_user_id: connection.controller_foundry_user_id,
        updated_at: now,
      }, { onConflict: 'connection_id,campaign_character_id' })

    if (mappingError) throw new FoundryIntegrationError(mappingError.message, 503, 'database_unavailable')

    const { error: staleStateError } = await admin
      .from('foundry_token_state')
      .delete()
      .eq('connection_id', connection.id)
      .eq('campaign_character_id', campaignCharacterId)
      .neq('foundry_actor_id', foundryActorId)

    if (staleStateError) throw new FoundryIntegrationError(staleStateError.message, 503, 'database_unavailable')

    return Response.json(
      { mapped: true, campaignCharacterId, foundryActorId },
      { headers: foundryCorsHeaders() },
    )
  } catch (error) {
    return foundryErrorResponse(error, true)
  }
}
