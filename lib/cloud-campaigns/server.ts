import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { CampaignMode, OnboardingStage, SavedAdventureState } from '@/lib/aigm/campaign-storage'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class CloudCampaignError extends Error {
  status: number
  code: string
  details?: Record<string, unknown>

  constructor(message: string, status = 500, code = 'cloud_campaign_error', details?: Record<string, unknown>) {
    super(message)
    this.name = 'CloudCampaignError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function cloudCampaignErrorResponse(error: unknown) {
  if (error instanceof CloudCampaignError) {
    return Response.json({ error: error.message, code: error.code, ...error.details }, { status: error.status, headers: { 'Cache-Control': 'no-store' } })
  }
  return Response.json({ error: error instanceof Error ? error.message : 'Cloud campaign request failed.', code: 'cloud_campaign_error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
}

export async function requireCloudCampaignUser(): Promise<User> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new CloudCampaignError('Sign in to use cloud campaigns.', 401, 'authentication_required')
  return data.user
}

function campaignId(value: unknown) {
  const id = typeof value === 'string' ? value.trim() : ''
  if (!UUID_PATTERN.test(id)) throw new CloudCampaignError('That campaign ID is not valid.', 400, 'invalid_campaign_id')
  return id
}

function modeFrom(value: unknown): CampaignMode {
  return value === 'multiplayer' ? 'multiplayer' : 'solo'
}

function stageFrom(value: unknown): OnboardingStage {
  return value === 'party' || value === 'calibration' ? value : 'complete'
}

function cleanName(value: unknown) {
  const name = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  if (!name) throw new CloudCampaignError('Give this campaign a name before saving it.', 400, 'campaign_name_required')
  return name.slice(0, 160)
}

function stateFrom(value: unknown, expectedId: string): SavedAdventureState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CloudCampaignError('The campaign state is not valid.', 400, 'invalid_campaign_state')
  const state = value as SavedAdventureState
  if (state.adventure_id !== expectedId) throw new CloudCampaignError('The campaign ID does not match the saved state.', 400, 'campaign_id_mismatch')
  if (!Array.isArray(state.characters) || !state.gameplay || typeof state.gameplay !== 'object') throw new CloudCampaignError('The campaign state is incomplete.', 400, 'invalid_campaign_state')
  return state
}

function partyNames(state: SavedAdventureState) {
  return state.characters.flatMap((character) => {
    const playName = typeof character.playName === 'string' ? character.playName.trim() : ''
    const recordName = typeof character.result?.character?.name === 'string' ? character.result.character.name.trim() : ''
    const name = playName || recordName
    return name ? [name.slice(0, 96)] : []
  }).slice(0, 6)
}

async function activeMembership(userId: string, id: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('campaign_members')
    .select('campaign_id')
    .eq('campaign_id', id)
    .eq('user_id', userId)
    .eq('membership_status', 'active')
    .maybeSingle()
  if (error) throw new CloudCampaignError(error.message, 503, 'cloud_campaign_database_unavailable')
  return Boolean(data)
}

export async function listCloudCampaigns(userId: string) {
  const admin = createAdminClient()
  const { data: memberships, error: membershipError } = await admin
    .from('campaign_members')
    .select('campaign_id')
    .eq('user_id', userId)
    .eq('membership_status', 'active')
  if (membershipError) throw new CloudCampaignError(membershipError.message, 503, 'cloud_campaign_database_unavailable')

  const ids = (memberships ?? []).map((entry: { campaign_id: string }) => entry.campaign_id)
  if (!ids.length) return []

  const { data, error } = await admin
    .from('campaigns')
    .select('id, mode, name, stage, party_names, revision, created_at, updated_at')
    .in('id', ids)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
  if (error) throw new CloudCampaignError(error.message, 503, 'cloud_campaign_database_unavailable')

  return (data ?? []).map((row: { id: string; mode: unknown; name: string; stage: unknown; party_names: unknown; revision: number | string; created_at: string; updated_at: string }) => ({
    adventure_id: row.id as string,
    adventure_name: row.name as string,
    campaign_mode: modeFrom(row.mode),
    stage: stageFrom(row.stage),
    party_names: Array.isArray(row.party_names) ? row.party_names.filter((name: unknown): name is string => typeof name === 'string') : [],
    cloud_revision: Number(row.revision) || 1,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }))
}

export async function loadCloudCampaign(userId: string, rawId: unknown) {
  const id = campaignId(rawId)
  if (!await activeMembership(userId, id)) throw new CloudCampaignError('That cloud campaign is not available to this account.', 404, 'campaign_not_found')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('campaigns')
    .select('id, mode, state, revision, updated_at')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new CloudCampaignError(error.message, 503, 'cloud_campaign_database_unavailable')
  if (!data) throw new CloudCampaignError('That cloud campaign is no longer available.', 404, 'campaign_not_found')

  await admin
    .from('campaign_members')
    .update({ last_opened_at: new Date().toISOString() })
    .eq('campaign_id', id)
    .eq('user_id', userId)
    .eq('membership_status', 'active')

  return {
    state: data.state as SavedAdventureState,
    revision: Number(data.revision) || 1,
    campaign_mode: modeFrom(data.mode),
    updated_at: data.updated_at as string,
  }
}

export async function saveCloudCampaign(user: User, rawId: unknown, input: {
  state: unknown
  expectedRevision: number
  mode?: unknown
}) {
  const id = campaignId(rawId)
  const state = stateFrom(input.state, id)
  const expectedRevision = Number.isFinite(input.expectedRevision) ? Math.max(0, Math.floor(input.expectedRevision)) : 0
  const mode = modeFrom(input.mode ?? state.campaign_mode)
  const name = cleanName(state.adventure_name)
  const stage = stageFrom(state.stage)
  const names = partyNames(state)
  const admin = createAdminClient()

  if (expectedRevision === 0) {
    const { data: existing, error: existingError } = await admin
      .from('campaigns')
      .select('revision')
      .eq('id', id)
      .maybeSingle()
    if (existingError) throw new CloudCampaignError(existingError.message, 503, 'cloud_campaign_database_unavailable')
    if (existing) {
      if (!await activeMembership(user.id, id)) throw new CloudCampaignError('That campaign ID already belongs to another cloud campaign.', 409, 'campaign_id_conflict')
      throw new CloudCampaignError('This campaign has a newer cloud revision. Reload it before continuing.', 409, 'revision_conflict', { current_revision: Number(existing.revision) || 1 })
    }

    const now = new Date().toISOString()
    const { error: campaignError } = await admin.from('campaigns').insert({
      id,
      created_by_user_id: user.id,
      mode,
      name,
      stage,
      party_names: names,
      state: { ...state, campaign_mode: mode },
      revision: 1,
      created_at: state.created_at || now,
      updated_at: state.updated_at || now,
    })
    if (campaignError) throw new CloudCampaignError(campaignError.message, 503, 'cloud_campaign_database_unavailable')

    const { error: memberError } = await admin.from('campaign_members').insert({
      campaign_id: id,
      user_id: user.id,
      membership_status: 'active',
      joined_at: now,
      last_opened_at: now,
    })
    if (memberError) {
      await admin.from('campaigns').delete().eq('id', id)
      throw new CloudCampaignError(memberError.message, 503, 'cloud_campaign_database_unavailable')
    }
    return { revision: 1, updated_at: state.updated_at || now }
  }

  if (!await activeMembership(user.id, id)) throw new CloudCampaignError('That cloud campaign is not available to this account.', 404, 'campaign_not_found')

  const nextRevision = expectedRevision + 1
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('campaigns')
    .update({
      mode,
      name,
      stage,
      party_names: names,
      state: { ...state, campaign_mode: mode },
      revision: nextRevision,
      updated_at: state.updated_at || now,
    })
    .eq('id', id)
    .eq('revision', expectedRevision)
    .is('deleted_at', null)
    .select('revision, updated_at')
    .maybeSingle()
  if (error) throw new CloudCampaignError(error.message, 503, 'cloud_campaign_database_unavailable')
  if (!data) {
    const { data: current } = await admin.from('campaigns').select('revision').eq('id', id).maybeSingle()
    throw new CloudCampaignError('This campaign changed somewhere else. Reload the cloud copy before continuing.', 409, 'revision_conflict', { current_revision: Number(current?.revision) || expectedRevision })
  }

  return { revision: Number(data.revision) || nextRevision, updated_at: data.updated_at as string }
}
