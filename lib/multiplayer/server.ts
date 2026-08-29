import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { MultiplayerCharacterSeat, MultiplayerParticipant, MultiplayerSessionStatus, MultiplayerSessionView } from '@/lib/multiplayer/types'
import { MultiplayerError } from '@/lib/multiplayer/errors'

const MAX_MULTIPLAYER_PLAYERS = 6
const MAX_CAMPAIGN_CHARACTERS = 6
const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000

export async function requireMultiplayerUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new MultiplayerError('Sign in to use multiplayer.', 401, 'authentication_required')
  return data.user
}

function cleanLabel(value: unknown, fallback: string, max = 80) {
  const clean = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  return (clean || fallback).slice(0, max)
}

export function multiplayerDisplayName(user: User) {
  const metadata = user.user_metadata as Record<string, unknown> | undefined
  const metadataName = metadata && typeof metadata.display_name === 'string' ? metadata.display_name : ''
  const fullName = metadata && typeof metadata.full_name === 'string' ? metadata.full_name : ''
  const emailName = user.email?.split('@')[0] ?? ''
  return cleanLabel(metadataName || fullName || emailName, 'Player', 48)
}

export function normalizeMultiplayerDisplayName(value: unknown) {
  const displayName = cleanLabel(value, '', 48)
  if (!displayName) throw new MultiplayerError('Choose a chat name before saving it.', 400, 'display_name_required')
  return displayName
}

export function createInviteCode() {
  return randomBytes(18).toString('base64url')
}

export function campaignFingerprint(localCampaignId: string) {
  return createHash('sha256').update(localCampaignId.trim()).digest('hex')
}

export function realtimeClientId(seatId: string, sessionId: string) {
  return `rpg-seat:${seatId}:room:${sessionId}`
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.rpgyourway.com').replace(/\/$/, '')
}

function inviteUrl(inviteCode: string) {
  return `${siteUrl()}/play?multiplayer=${encodeURIComponent(inviteCode)}`
}

type SessionRow = {
  id: string
  invite_code: string
  campaign_id: string | null
  campaign_name: string
  campaign_fingerprint: string
  coordinator_user_id: string
  status: MultiplayerSessionStatus
  expires_at: string | null
}

type SeatRow = {
  id: string
  session_id: string
  user_id: string
  display_name: string
  payer_user_id: string
  is_active: boolean
}

type CharacterRow = {
  session_id: string
  character_id: string
  display_name: string
  ordinal: number
}

type CharacterClaimRow = {
  session_id: string
  seat_id: string
  character_id: string
}

function cleanCharacterRows(input: Array<{ characterId: string; displayName: string }>) {
  const seen = new Set<string>()
  return input
    .filter((entry) => entry && typeof entry.characterId === 'string' && entry.characterId.trim())
    .map((entry) => ({
      characterId: entry.characterId.trim().slice(0, 160),
      displayName: cleanLabel(entry.displayName, 'Character', 96),
    }))
    .filter((entry) => {
      if (seen.has(entry.characterId)) return false
      seen.add(entry.characterId)
      return true
    })
    .slice(0, MAX_CAMPAIGN_CHARACTERS)
    .map((entry, index) => ({
      character_id: entry.characterId,
      display_name: entry.displayName || `Character ${index + 1}`,
      ordinal: index,
    }))
}

export async function loadSessionByInvite(inviteCode: string, userId: string): Promise<MultiplayerSessionView> {
  const cleanCode = inviteCode.trim()
  if (!cleanCode || cleanCode.length > 96) throw new MultiplayerError('That multiplayer invite is not valid.', 404, 'invite_not_found')

  const admin = createAdminClient()
  const { data: sessionData, error: sessionError } = await admin
    .from('multiplayer_sessions')
    .select('id, invite_code, campaign_id, campaign_name, campaign_fingerprint, coordinator_user_id, status, expires_at')
    .eq('invite_code', cleanCode)
    .maybeSingle()

  if (sessionError) throw new MultiplayerError(sessionError.message, 503, 'multiplayer_database_unavailable')
  if (!sessionData) throw new MultiplayerError('That multiplayer invite is no longer available.', 404, 'invite_not_found')

  const session = sessionData as SessionRow
  if (session.status === 'closed') throw new MultiplayerError('That multiplayer session has closed.', 410, 'session_closed')
  if (session.expires_at && Date.parse(session.expires_at) <= Date.now()) throw new MultiplayerError('That multiplayer invite has expired.', 410, 'session_expired')

  let campaignRevision = 0
  if (session.campaign_id) {
    const { data: campaignData, error: campaignError } = await admin
      .from('campaigns')
      .select('revision')
      .eq('id', session.campaign_id)
      .is('deleted_at', null)
      .maybeSingle()
    if (campaignError) throw new MultiplayerError(campaignError.message, 503, 'multiplayer_database_unavailable')
    if (!campaignData) throw new MultiplayerError('That multiplayer campaign is no longer available.', 410, 'campaign_closed')
    campaignRevision = Math.max(1, Number(campaignData.revision) || 1)
  }

  const [
    { data: seatData, error: seatError },
    { data: characterData, error: characterError },
    { data: claimData, error: claimError },
  ] = await Promise.all([
    admin
      .from('multiplayer_seats')
      .select('id, session_id, user_id, display_name, payer_user_id, is_active')
      .eq('session_id', session.id)
      .eq('is_active', true)
      .order('joined_at', { ascending: true }),
    admin
      .from('multiplayer_session_characters')
      .select('session_id, character_id, display_name, ordinal')
      .eq('session_id', session.id)
      .order('ordinal', { ascending: true }),
    admin
      .from('multiplayer_character_claims')
      .select('session_id, seat_id, character_id')
      .eq('session_id', session.id),
  ])

  if (seatError || characterError || claimError) {
    throw new MultiplayerError(seatError?.message || characterError?.message || claimError?.message || 'Could not load the multiplayer lobby.', 503, 'multiplayer_database_unavailable')
  }

  const seats = (seatData || []) as SeatRow[]
  const characters = (characterData || []) as CharacterRow[]
  const claims = (claimData || []) as CharacterClaimRow[]
  const characterNames = new Map(characters.map((entry) => [entry.character_id, entry.display_name]))
  const ordinalByCharacter = new Map(characters.map((entry) => [entry.character_id, entry.ordinal]))
  const claimsBySeat = new Map<string, string[]>()
  for (const claim of claims) {
    const current = claimsBySeat.get(claim.seat_id) ?? []
    current.push(claim.character_id)
    claimsBySeat.set(claim.seat_id, current)
  }
  for (const [seatId, ids] of claimsBySeat) {
    ids.sort((left, right) => (ordinalByCharacter.get(left) ?? 999) - (ordinalByCharacter.get(right) ?? 999))
    claimsBySeat.set(seatId, ids)
  }

  const selfSeat = seats.find((seat) => seat.user_id === userId) ?? null
  const coordinatorSeat = seats.find((seat) => seat.user_id === session.coordinator_user_id) ?? null
  const participants: MultiplayerParticipant[] = seats.map((seat) => {
    const characterIds = claimsBySeat.get(seat.id) ?? []
    const controlledNames = characterIds.map((id) => characterNames.get(id)).filter((value): value is string => Boolean(value))
    return {
      seatId: seat.id,
      displayName: seat.display_name,
      characterIds,
      characterNames: controlledNames,
      characterId: characterIds[0] ?? null,
      characterName: controlledNames[0] ?? null,
      isCoordinator: seat.user_id === session.coordinator_user_id,
      isSelf: seat.user_id === userId,
      realtimeClientId: realtimeClientId(seat.id, session.id),
    }
  })

  const playerCapacity = Math.max(1, Math.min(MAX_MULTIPLAYER_PLAYERS, characters.length))

  return {
    id: session.id,
    inviteCode: session.invite_code,
    campaignId: session.campaign_id,
    campaignName: session.campaign_name,
    campaignFingerprint: session.campaign_fingerprint,
    campaignRevision,
    status: session.status,
    coordinatorSeatId: coordinatorSeat?.id ?? null,
    isCoordinator: session.coordinator_user_id === userId,
    isMember: Boolean(selfSeat),
    selfSeatId: selfSeat?.id ?? null,
    inviteUrl: inviteUrl(session.invite_code),
    expiresAt: session.expires_at,
    participants,
    characters: characters.map((entry): MultiplayerCharacterSeat => ({
      characterId: entry.character_id,
      displayName: entry.display_name,
      ordinal: entry.ordinal,
    })),
    playerCapacity,
  }
}

export async function createMultiplayerSession(user: User, input: {
  localCampaignId: string
  campaignName: string
  characters: Array<{ characterId: string; displayName: string }>
}) {
  const localCampaignId = cleanLabel(input.localCampaignId, '', 160)
  if (!localCampaignId) throw new MultiplayerError('Open a saved campaign before starting multiplayer.', 400, 'campaign_required')
  const campaignName = cleanLabel(input.campaignName, 'Multiplayer campaign', 120)
  const characters = cleanCharacterRows(input.characters)

  if (characters.length === 0) throw new MultiplayerError('This campaign needs at least one ready character before multiplayer can start.', 400, 'characters_required')

  const admin = createAdminClient()
  const { data: membership, error: membershipError } = await admin
    .from('campaign_members')
    .select('membership_status')
    .eq('campaign_id', localCampaignId)
    .eq('user_id', user.id)
    .eq('membership_status', 'active')
    .maybeSingle()
  if (membershipError) throw new MultiplayerError(membershipError.message, 503, 'multiplayer_database_unavailable')
  if (!membership) throw new MultiplayerError('Open the canonical cloud campaign before starting multiplayer.', 403, 'campaign_membership_required')
  const { data: campaign, error: campaignError } = await admin
    .from('campaigns')
    .select('id, mode')
    .eq('id', localCampaignId)
    .eq('mode', 'multiplayer')
    .is('deleted_at', null)
    .maybeSingle()
  if (campaignError) throw new MultiplayerError(campaignError.message, 503, 'multiplayer_database_unavailable')
  if (!campaign) throw new MultiplayerError('This campaign is not configured for multiplayer.', 409, 'multiplayer_campaign_required')

  // A cloud campaign has one live multiplayer table. Reopening Multiplayer from
  // another member joins the existing table instead of creating a competing room.
  const nowIso = new Date().toISOString()
  await admin.from('multiplayer_sessions')
    .update({ status: 'closed', updated_at: nowIso })
    .eq('campaign_id', localCampaignId)
    .neq('status', 'closed')
    .lte('expires_at', nowIso)

  const { data: existingSessions, error: existingSessionError } = await admin
    .from('multiplayer_sessions')
    .select('invite_code,expires_at')
    .eq('campaign_id', localCampaignId)
    .neq('status', 'closed')
    .order('created_at', { ascending: false })
    .limit(5)
  if (existingSessionError) throw new MultiplayerError(existingSessionError.message, 503, 'multiplayer_database_unavailable')
  const existingSession = (existingSessions || []).find((entry) => !entry.expires_at || Date.parse(entry.expires_at) > Date.now())
  if (existingSession?.invite_code) return joinMultiplayerSession(user, existingSession.invite_code)

  const sessionId = randomUUID()
  const code = createInviteCode()
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS).toISOString()
  const fingerprint = campaignFingerprint(localCampaignId)

  const { error: sessionError } = await admin.from('multiplayer_sessions').insert({
    id: sessionId,
    invite_code: code,
    campaign_id: localCampaignId,
    campaign_name: campaignName,
    campaign_fingerprint: fingerprint,
    coordinator_user_id: user.id,
    status: 'lobby',
    expires_at: expiresAt,
  })
  if (sessionError) {
    if (/duplicate|unique/i.test(sessionError.message)) {
      const { data: racedSession, error: racedSessionError } = await admin
        .from('multiplayer_sessions')
        .select('invite_code')
        .eq('campaign_id', localCampaignId)
        .neq('status', 'closed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!racedSessionError && racedSession?.invite_code) return joinMultiplayerSession(user, racedSession.invite_code)
    }
    throw new MultiplayerError(sessionError.message, 503, 'multiplayer_database_unavailable')
  }

  const seatId = randomUUID()
  const { error: seatError } = await admin.from('multiplayer_seats').insert({
    id: seatId,
    session_id: sessionId,
    user_id: user.id,
    display_name: multiplayerDisplayName(user),
    payer_user_id: user.id,
    is_active: true,
    last_seen_at: new Date().toISOString(),
  })
  if (seatError) {
    await admin.from('multiplayer_sessions').delete().eq('id', sessionId)
    throw new MultiplayerError(seatError.message, 503, 'multiplayer_database_unavailable')
  }

  const { error: characterError } = await admin.from('multiplayer_session_characters').insert(characters.map((character) => ({ ...character, session_id: sessionId })))
  if (characterError) {
    await admin.from('multiplayer_sessions').delete().eq('id', sessionId)
    throw new MultiplayerError(characterError.message, 503, 'multiplayer_database_unavailable')
  }

  return loadSessionByInvite(code, user.id)
}

export async function joinMultiplayerSession(user: User, inviteCode: string) {
  const lobby = await loadSessionByInvite(inviteCode, user.id)
  if (lobby.isMember) return lobby
  if (lobby.participants.length >= lobby.playerCapacity) {
    throw new MultiplayerError(`This campaign currently has room for ${lobby.playerCapacity} human player${lobby.playerCapacity === 1 ? '' : 's'}.`, 409, 'session_full')
  }

  const admin = createAdminClient()
  if (lobby.campaignId) {
    const { data: existingMembership, error: membershipQueryError } = await admin
      .from('campaign_members')
      .select('membership_status')
      .eq('campaign_id', lobby.campaignId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (membershipQueryError) throw new MultiplayerError(membershipQueryError.message, 503, 'multiplayer_database_unavailable')
    if (existingMembership?.membership_status === 'removed') throw new MultiplayerError('This campaign removed your membership. A current member must resolve that before you can rejoin.', 403, 'campaign_membership_removed')
    const now = new Date().toISOString()
    const { error: memberError } = await admin.from('campaign_members').upsert({
      campaign_id: lobby.campaignId,
      user_id: user.id,
      membership_status: 'active',
      joined_at: now,
      last_opened_at: now,
      display_name: multiplayerDisplayName(user),
    }, { onConflict: 'campaign_id,user_id' })
    if (memberError) throw new MultiplayerError(memberError.message, 503, 'multiplayer_database_unavailable')
  }
  const { error } = await admin.from('multiplayer_seats').insert({
    id: randomUUID(),
    session_id: lobby.id,
    user_id: user.id,
    display_name: multiplayerDisplayName(user),
    payer_user_id: user.id,
    is_active: true,
    last_seen_at: new Date().toISOString(),
  })
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return loadSessionByInvite(inviteCode, user.id)
    throw new MultiplayerError(error.message, 503, 'multiplayer_database_unavailable')
  }
  return loadSessionByInvite(inviteCode, user.id)
}

export async function updateMultiplayerDisplayName(userId: string, inviteCode: string, displayName: unknown) {
  const lobby = await loadSessionByInvite(inviteCode, userId)
  if (!lobby.selfSeatId) throw new MultiplayerError('Join this multiplayer table before changing your chat name.', 403, 'membership_required')
  const cleanName = normalizeMultiplayerDisplayName(displayName)
  const admin = createAdminClient()
  const { error } = await admin
    .from('multiplayer_seats')
    .update({ display_name: cleanName, updated_at: new Date().toISOString() })
    .eq('id', lobby.selfSeatId)
    .eq('user_id', userId)
    .eq('is_active', true)
  if (error) throw new MultiplayerError(error.message, 503, 'multiplayer_database_unavailable')
  return loadSessionByInvite(inviteCode, userId)
}

export async function setMultiplayerCharacterClaim(userId: string, inviteCode: string, characterId: string, claimed: boolean) {
  const lobby = await loadSessionByInvite(inviteCode, userId)
  if (!lobby.selfSeatId) throw new MultiplayerError('Join this multiplayer table before choosing characters.', 403, 'membership_required')

  const cleanCharacterId = characterId.trim()
  if (!cleanCharacterId || !lobby.characters.some((character) => character.characterId === cleanCharacterId)) {
    throw new MultiplayerError('That character is not available in this campaign.', 400, 'character_not_found')
  }

  const owner = lobby.participants.find((participant) => !participant.isSelf && participant.characterIds.includes(cleanCharacterId))
  if (claimed && owner) throw new MultiplayerError(`${owner.displayName} already controls that character.`, 409, 'character_claimed')

  const admin = createAdminClient()
  if (claimed) {
    const { error } = await admin.from('multiplayer_character_claims').insert({
      session_id: lobby.id,
      seat_id: lobby.selfSeatId,
      character_id: cleanCharacterId,
    })
    if (error && !/duplicate|unique/i.test(error.message)) throw new MultiplayerError(error.message, 503, 'multiplayer_database_unavailable')
    if (error && /duplicate|unique/i.test(error.message)) {
      const refreshed = await loadSessionByInvite(inviteCode, userId)
      const alreadySelf = refreshed.participants.find((participant) => participant.isSelf)?.characterIds.includes(cleanCharacterId)
      if (!alreadySelf) throw new MultiplayerError('Another player just claimed that character.', 409, 'character_claimed')
      return refreshed
    }
  } else {
    const { error } = await admin
      .from('multiplayer_character_claims')
      .delete()
      .eq('session_id', lobby.id)
      .eq('seat_id', lobby.selfSeatId)
      .eq('character_id', cleanCharacterId)
    if (error) throw new MultiplayerError(error.message, 503, 'multiplayer_database_unavailable')
  }

  return loadSessionByInvite(inviteCode, userId)
}

export async function syncMultiplayerCharacters(userId: string, inviteCode: string, input: Array<{ characterId: string; displayName: string }>) {
  const lobby = await loadSessionByInvite(inviteCode, userId)
  if (!lobby.isCoordinator) throw new MultiplayerError('Only the coordinator can update the multiplayer campaign roster.', 403, 'coordinator_required')
  const characters = cleanCharacterRows(input)
  if (!characters.length) throw new MultiplayerError('The multiplayer campaign needs at least one character.', 400, 'characters_required')

  const admin = createAdminClient()
  const { data: existingRows, error: existingError } = await admin
    .from('multiplayer_session_characters')
    .select('character_id')
    .eq('session_id', lobby.id)
  if (existingError) throw new MultiplayerError(existingError.message, 503, 'multiplayer_database_unavailable')

  const incomingIds = new Set(characters.map((character) => character.character_id))
  const removedIds = (existingRows ?? [])
    .map((row) => typeof row.character_id === 'string' ? row.character_id : '')
    .filter((characterId) => characterId && !incomingIds.has(characterId))

  if (removedIds.length) {
    const { error: claimDeleteError } = await admin
      .from('multiplayer_character_claims')
      .delete()
      .eq('session_id', lobby.id)
      .in('character_id', removedIds)
    if (claimDeleteError) throw new MultiplayerError(claimDeleteError.message, 503, 'multiplayer_database_unavailable')

    const { error: rosterDeleteError } = await admin
      .from('multiplayer_session_characters')
      .delete()
      .eq('session_id', lobby.id)
      .in('character_id', removedIds)
    if (rosterDeleteError) throw new MultiplayerError(rosterDeleteError.message, 503, 'multiplayer_database_unavailable')
  }

  const { error } = await admin.from('multiplayer_session_characters').upsert(
    characters.map((character) => ({ ...character, session_id: lobby.id })),
    { onConflict: 'session_id,character_id' },
  )
  if (error) throw new MultiplayerError(error.message, 503, 'multiplayer_database_unavailable')

  return loadSessionByInvite(inviteCode, userId)
}

export async function leaveMultiplayerSession(userId: string, inviteCode: string) {
  const lobby = await loadSessionByInvite(inviteCode, userId)
  if (!lobby.selfSeatId) throw new MultiplayerError('You are not currently seated at this multiplayer table.', 409, 'membership_required')
  if (lobby.isCoordinator) throw new MultiplayerError('The coordinator must close the multiplayer session rather than leave it.', 409, 'coordinator_must_close')

  const admin = createAdminClient()
  const { error: claimError } = await admin.from('multiplayer_character_claims').delete().eq('seat_id', lobby.selfSeatId)
  if (claimError) throw new MultiplayerError(claimError.message, 503, 'multiplayer_database_unavailable')
  const { error } = await admin
    .from('multiplayer_seats')
    .update({ is_active: false, character_id: null, updated_at: new Date().toISOString() })
    .eq('id', lobby.selfSeatId)
    .eq('user_id', userId)
    .eq('is_active', true)
  if (error) throw new MultiplayerError(error.message, 503, 'multiplayer_database_unavailable')
  return { left: true }
}

export async function closeMultiplayerSession(userId: string, inviteCode: string) {
  const lobby = await loadSessionByInvite(inviteCode, userId)
  if (!lobby.isCoordinator) throw new MultiplayerError('Only the coordinator can close this multiplayer session.', 403, 'coordinator_required')
  const admin = createAdminClient()
  const { error } = await admin.from('multiplayer_sessions').update({ status: 'closed', updated_at: new Date().toISOString() }).eq('id', lobby.id).eq('coordinator_user_id', userId)
  if (error) throw new MultiplayerError(error.message, 503, 'multiplayer_database_unavailable')
  return { closed: true }
}

export async function heartbeatMultiplayerSession(userId: string, inviteCode: string) {
  const lobby = await loadSessionByInvite(inviteCode, userId)
  if (!lobby.selfSeatId) throw new MultiplayerError('Join this multiplayer table before sending a heartbeat.', 403, 'membership_required')
  const admin = createAdminClient()
  const { error } = await admin
    .from('multiplayer_seats')
    .update({ last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', lobby.selfSeatId)
    .eq('user_id', userId)
    .eq('is_active', true)
  if (error) throw new MultiplayerError(error.message, 503, 'multiplayer_database_unavailable')
  return loadSessionByInvite(inviteCode, userId)
}

export async function beginMultiplayerTurn(user: User, inviteCode: string, turnId: string, expectedRevision: number) {
  const lobby = await loadSessionByInvite(inviteCode, user.id)
  if (!lobby.isMember || !lobby.selfSeatId) throw new MultiplayerError('Join this multiplayer table before sending a turn.', 403, 'membership_required')
  if (!lobby.campaignId) throw new MultiplayerError('This multiplayer table is not attached to a cloud campaign.', 409, 'campaign_required')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(turnId)) {
    throw new MultiplayerError('That multiplayer turn id is not valid.', 400, 'turn_id_invalid')
  }
  const revision = Math.max(1, Math.trunc(expectedRevision || 0))
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('rpgyw_begin_multiplayer_turn', {
    p_turn_id: turnId,
    p_session_id: lobby.id,
    p_campaign_id: lobby.campaignId,
    p_submitter_user_id: user.id,
    p_expected_revision: revision,
    p_lease_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  })
  if (error) {
    const message = error.message || ''
    if (message.includes('MULTIPLAYER_TURN_IN_PROGRESS')) throw new MultiplayerError('Another player is sending a turn. RPG Your Way will keep turns in order; try again after that reply finishes.', 409, 'turn_in_progress')
    const revisionMatch = message.match(/MULTIPLAYER_REVISION_CONFLICT:(\d+)/)
    if (revisionMatch) throw new MultiplayerError('The campaign changed on another device. RPG Your Way needs to reload the newest cloud state before you send this turn.', 409, 'revision_conflict')
    if (message.includes('MULTIPLAYER_TURN_ID_REUSED')) throw new MultiplayerError('That turn id was already used for another multiplayer request.', 409, 'turn_id_reused')
    throw new MultiplayerError(message || 'RPG Your Way could not reserve the multiplayer turn.', 503, 'multiplayer_turn_unavailable')
  }
  return { turnId, campaignId: lobby.campaignId, revision: Math.max(1, Number(data) || revision) }
}

export async function completeMultiplayerTurn(userId: string, inviteCode: string, turnId: string, finalRevision: number) {
  const lobby = await loadSessionByInvite(inviteCode, userId)
  if (!lobby.isMember || !lobby.campaignId) throw new MultiplayerError('This multiplayer campaign is not available to this account.', 403, 'membership_required')
  const committedRevision = Math.max(1, Math.trunc(finalRevision || 0))
  const admin = createAdminClient()
  const [{ data: turnRow, error: turnReadError }, { data: campaignRow, error: campaignReadError }] = await Promise.all([
    admin.from('multiplayer_turns').select('expected_campaign_revision,turn_status').eq('id', turnId).eq('session_id', lobby.id).eq('campaign_id', lobby.campaignId).eq('submitted_by_user_id', userId).maybeSingle(),
    admin.from('campaigns').select('revision').eq('id', lobby.campaignId).is('deleted_at', null).maybeSingle(),
  ])
  if (turnReadError || campaignReadError) throw new MultiplayerError(turnReadError?.message || campaignReadError?.message || 'The shared turn could not be verified.', 503, 'multiplayer_turn_unavailable')
  if (!turnRow || !campaignRow) throw new MultiplayerError('That multiplayer turn is no longer waiting to be committed.', 409, 'turn_not_pending')
  if (committedRevision !== Number(campaignRow.revision) || committedRevision <= Number(turnRow.expected_campaign_revision)) {
    throw new MultiplayerError('The shared campaign revision does not match this completed turn. RPG Your Way will resynchronize the table before another turn.', 409, 'revision_conflict')
  }
  const { data, error } = await admin
    .from('multiplayer_turns')
    .update({
      turn_status: 'committed',
      committed_campaign_revision: committedRevision,
      lease_expires_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', turnId)
    .eq('session_id', lobby.id)
    .eq('campaign_id', lobby.campaignId)
    .eq('submitted_by_user_id', userId)
    .in('turn_status', ['pending', 'held', 'ai_complete'])
    .select('id')
    .maybeSingle()
  if (error) throw new MultiplayerError(error.message, 503, 'multiplayer_turn_unavailable')
  if (!data) throw new MultiplayerError('That multiplayer turn is no longer waiting to be committed.', 409, 'turn_not_pending')
  return loadSessionByInvite(inviteCode, userId)
}

export async function releaseMultiplayerTurn(userId: string, inviteCode: string, turnId: string) {
  const lobby = await loadSessionByInvite(inviteCode, userId)
  if (!lobby.isMember || !lobby.campaignId) return
  const admin = createAdminClient()
  await admin.from('multiplayer_turns').update({ turn_status: 'released', updated_at: new Date().toISOString() })
    .eq('id', turnId)
    .eq('session_id', lobby.id)
    .eq('campaign_id', lobby.campaignId)
    .eq('submitted_by_user_id', userId)
    .in('turn_status', ['pending', 'held', 'ai_complete'])
}
