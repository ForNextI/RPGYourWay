import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { MultiplayerCharacterSeat, MultiplayerParticipant, MultiplayerSessionStatus, MultiplayerSessionView } from '@/lib/multiplayer/types'
import { MultiplayerError } from '@/lib/multiplayer/errors'
import { isOwnerQaEmail } from '@/lib/usage/owner-qa'

const MAX_MULTIPLAYER_SEATS = 6
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
  character_id: string | null
  payer_user_id: string
  is_active: boolean
}

type CharacterRow = {
  session_id: string
  character_id: string
  display_name: string
  ordinal: number
}

export async function loadSessionByInvite(inviteCode: string, userId: string): Promise<MultiplayerSessionView> {
  const cleanCode = inviteCode.trim()
  if (!cleanCode || cleanCode.length > 96) throw new MultiplayerError('That multiplayer invite is not valid.', 404, 'invite_not_found')

  const admin = createAdminClient()
  const { data: sessionData, error: sessionError } = await admin
    .from('multiplayer_sessions')
    .select('id, invite_code, campaign_name, campaign_fingerprint, coordinator_user_id, status, expires_at')
    .eq('invite_code', cleanCode)
    .maybeSingle()

  if (sessionError) throw new MultiplayerError(sessionError.message, 503, 'multiplayer_database_unavailable')
  if (!sessionData) throw new MultiplayerError('That multiplayer invite is no longer available.', 404, 'invite_not_found')

  const session = sessionData as SessionRow
  if (session.status === 'closed') throw new MultiplayerError('That multiplayer session has closed.', 410, 'session_closed')
  if (session.expires_at && Date.parse(session.expires_at) <= Date.now()) throw new MultiplayerError('That multiplayer invite has expired.', 410, 'session_expired')

  const [{ data: seatData, error: seatError }, { data: characterData, error: characterError }] = await Promise.all([
    admin
      .from('multiplayer_seats')
      .select('id, session_id, user_id, display_name, character_id, payer_user_id, is_active')
      .eq('session_id', session.id)
      .eq('is_active', true)
      .order('joined_at', { ascending: true }),
    admin
      .from('multiplayer_session_characters')
      .select('session_id, character_id, display_name, ordinal')
      .eq('session_id', session.id)
      .order('ordinal', { ascending: true }),
  ])

  if (seatError || characterError) throw new MultiplayerError(seatError?.message || characterError?.message || 'Could not load the multiplayer lobby.', 503, 'multiplayer_database_unavailable')

  const seats = (seatData || []) as SeatRow[]
  const characters = (characterData || []) as CharacterRow[]
  const characterNames = new Map(characters.map((entry) => [entry.character_id, entry.display_name]))
  const selfSeat = seats.find((seat) => seat.user_id === userId) ?? null
  const coordinatorSeat = seats.find((seat) => seat.user_id === session.coordinator_user_id) ?? null
  const participants: MultiplayerParticipant[] = seats.map((seat) => ({
    seatId: seat.id,
    displayName: seat.display_name,
    characterId: seat.character_id,
    characterName: seat.character_id ? characterNames.get(seat.character_id) ?? null : null,
    isCoordinator: seat.user_id === session.coordinator_user_id,
    isSelf: seat.user_id === userId,
    realtimeClientId: realtimeClientId(seat.id, session.id),
  }))

  return {
    id: session.id,
    inviteCode: session.invite_code,
    campaignName: session.campaign_name,
    campaignFingerprint: session.campaign_fingerprint,
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
  }
}

export async function createMultiplayerSession(user: User, input: {
  localCampaignId: string
  campaignName: string
  characters: Array<{ characterId: string; displayName: string }>
}) {
  if (!isOwnerQaEmail(user.email)) throw new MultiplayerError('Native multiplayer is still in private table testing.', 403, 'multiplayer_private_test')
  const localCampaignId = cleanLabel(input.localCampaignId, '', 160)
  if (!localCampaignId) throw new MultiplayerError('Open a saved campaign before starting multiplayer.', 400, 'campaign_required')
  const campaignName = cleanLabel(input.campaignName, 'Multiplayer campaign', 120)
  const characters = input.characters
    .filter((entry) => entry && typeof entry.characterId === 'string' && entry.characterId.trim())
    .slice(0, MAX_MULTIPLAYER_SEATS)
    .map((entry, index) => ({
      character_id: entry.characterId.trim().slice(0, 160),
      display_name: cleanLabel(entry.displayName, `Character ${index + 1}`, 96),
      ordinal: index,
    }))

  if (characters.length === 0) throw new MultiplayerError('This campaign needs at least one ready character before multiplayer can start.', 400, 'characters_required')

  const admin = createAdminClient()
  const sessionId = randomUUID()
  const code = createInviteCode()
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS).toISOString()
  const fingerprint = campaignFingerprint(localCampaignId)

  const { error: sessionError } = await admin.from('multiplayer_sessions').insert({
    id: sessionId,
    invite_code: code,
    campaign_name: campaignName,
    campaign_fingerprint: fingerprint,
    coordinator_user_id: user.id,
    status: 'lobby',
    expires_at: expiresAt,
  })
  if (sessionError) throw new MultiplayerError(sessionError.message, 503, 'multiplayer_database_unavailable')

  const seatId = randomUUID()
  const { error: seatError } = await admin.from('multiplayer_seats').insert({
    id: seatId,
    session_id: sessionId,
    user_id: user.id,
    display_name: multiplayerDisplayName(user),
    payer_user_id: user.id,
    is_active: true,
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
  if (lobby.participants.length >= MAX_MULTIPLAYER_SEATS) throw new MultiplayerError('This multiplayer table already has six players.', 409, 'session_full')

  const admin = createAdminClient()
  const { error } = await admin.from('multiplayer_seats').insert({
    id: randomUUID(),
    session_id: lobby.id,
    user_id: user.id,
    display_name: multiplayerDisplayName(user),
    payer_user_id: user.id,
    is_active: true,
  })
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return loadSessionByInvite(inviteCode, user.id)
    throw new MultiplayerError(error.message, 503, 'multiplayer_database_unavailable')
  }
  return loadSessionByInvite(inviteCode, user.id)
}

export async function claimMultiplayerCharacter(userId: string, inviteCode: string, characterId: string | null) {
  const lobby = await loadSessionByInvite(inviteCode, userId)
  if (!lobby.selfSeatId) throw new MultiplayerError('Join this multiplayer table before choosing a character.', 403, 'membership_required')

  const cleanCharacterId = characterId?.trim() || null
  if (cleanCharacterId && !lobby.characters.some((character) => character.characterId === cleanCharacterId)) {
    throw new MultiplayerError('That character is not available in this campaign.', 400, 'character_not_found')
  }
  if (cleanCharacterId && lobby.participants.some((participant) => participant.characterId === cleanCharacterId && !participant.isSelf)) {
    throw new MultiplayerError('Another player already controls that character.', 409, 'character_claimed')
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('multiplayer_seats')
    .update({ character_id: cleanCharacterId, updated_at: new Date().toISOString() })
    .eq('id', lobby.selfSeatId)
    .eq('user_id', userId)
    .eq('is_active', true)
  if (error) {
    if (/duplicate|unique/i.test(error.message)) throw new MultiplayerError('Another player just claimed that character.', 409, 'character_claimed')
    throw new MultiplayerError(error.message, 503, 'multiplayer_database_unavailable')
  }
  return loadSessionByInvite(inviteCode, userId)
}

export async function leaveMultiplayerSession(userId: string, inviteCode: string) {
  const lobby = await loadSessionByInvite(inviteCode, userId)
  if (!lobby.selfSeatId) throw new MultiplayerError('You are not currently seated at this multiplayer table.', 409, 'membership_required')
  if (lobby.isCoordinator) throw new MultiplayerError('The coordinator must close the multiplayer session rather than leave it.', 409, 'coordinator_must_close')

  const admin = createAdminClient()
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
