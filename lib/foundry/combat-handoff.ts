import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  FoundryIntegrationError,
  requireFoundrySession,
} from '@/lib/foundry/server'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_PARTY = 12
const MAX_ENEMIES = 40
const CONTROLLER_ACTIVE_MS = 15_000

type JsonObject = Record<string, unknown>

function plainObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function cleanUuid(value: unknown, label: string) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!UUID_PATTERN.test(text)) {
    throw new FoundryIntegrationError(`${label} is not valid.`, 400, 'invalid_identifier')
  }
  return text
}

function cleanText(value: unknown, label: string, maximum: number, required = true) {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  if (required && !text) {
    throw new FoundryIntegrationError(`${label} is required.`, 400, 'invalid_foundry_encounter')
  }
  return text.slice(0, maximum)
}

function finiteNumber(value: unknown, fallback: number | null = null) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function safeInteger(value: unknown, fallback = 0) {
  const number = finiteNumber(value, fallback)
  return Math.trunc(number ?? fallback)
}

function normalizeLaunchUrl(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return null

  let url: URL
  try {
    url = new URL(text)
  } catch {
    throw new FoundryIntegrationError('The Foundry launch URL is not valid.', 400, 'invalid_foundry_launch_url')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new FoundryIntegrationError('The Foundry launch URL must use HTTP or HTTPS.', 400, 'invalid_foundry_launch_url')
  }

  url.hash = ''
  return url.toString().slice(0, 1000)
}

async function requireMembership(userId: string, campaignId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('campaign_members')
    .select('campaign_id')
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)
    .eq('membership_status', 'active')
    .maybeSingle()

  if (error) throw new FoundryIntegrationError(error.message, 503, 'database_unavailable')
  if (!data) throw new FoundryIntegrationError('That campaign is not available to this account.', 404, 'campaign_not_found')
}

async function activeConnection(campaignId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('foundry_connections')
    .select('id, campaign_id, foundry_world_label, controller_foundry_user_name, launch_url, last_seen_at')
    .eq('campaign_id', campaignId)
    .eq('status', 'active')
    .order('last_seen_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new FoundryIntegrationError(error.message, 503, 'database_unavailable')
  return data
}

function normalizeParty(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PARTY) {
    throw new FoundryIntegrationError('The VTT party list is not valid.', 400, 'invalid_foundry_encounter')
  }

  return value.map((entry, index) => {
    if (!plainObject(entry)) {
      throw new FoundryIntegrationError(`Party member ${index + 1} is not valid.`, 400, 'invalid_foundry_encounter')
    }

    const current = Math.max(0, safeInteger(entry.currentHitPoints))
    const maximum = Math.max(1, safeInteger(entry.maximumHitPoints, Math.max(1, current)))
    const temporary = Math.max(0, safeInteger(entry.temporaryHitPoints))

    return {
      campaignCharacterId: cleanText(entry.campaignCharacterId, `Party member ${index + 1} ID`, 180),
      displayName: cleanText(entry.displayName, `Party member ${index + 1} name`, 80),
      currentHitPoints: Math.min(current, maximum),
      maximumHitPoints: maximum,
      temporaryHitPoints: temporary,
      armorClass: Math.max(0, safeInteger(entry.armorClass)),
      initiative: finiteNumber(entry.initiative),
      visualTags: Array.isArray(entry.visualTags)
        ? entry.visualTags
            .filter((tag): tag is string => typeof tag === 'string')
            .map((tag) => tag.replace(/\s+/g, ' ').trim().slice(0, 80))
            .filter(Boolean)
            .slice(0, 12)
        : [],
    }
  })
}

function normalizeVttSetup(value: unknown) {
  if (!plainObject(value) || value.enabled !== true) return null

  const snap = (raw: unknown, fallback: number, maximum: number) => {
    const number = finiteNumber(raw, fallback) ?? fallback
    return Math.max(0, Math.min(maximum, Math.round(number / 5) * 5))
  }
  const width = Math.max(20, snap(value.width_ft, 60, 300))
  const height = Math.max(20, snap(value.height_ft, 40, 300))
  const start = plainObject(value.player_start_area) ? value.player_start_area : {}

  return {
    enabled: true,
    environment: cleanText(value.environment, 'VTT environment', 120, false) || 'combat area',
    width_ft: width,
    height_ft: height,
    player_start_area: {
      x_ft: snap(start.x_ft, 5, width),
      y_ft: snap(start.y_ft, 5, height),
      width_ft: Math.max(5, snap(start.width_ft, 15, width)),
      height_ft: Math.max(5, snap(start.height_ft, Math.max(10, height - 10), height)),
    },
    features: Array.isArray(value.features)
      ? value.features.slice(0, 16).flatMap((entry) => {
          if (!plainObject(entry)) return []
          const kind = entry.kind === 'wall'
            || entry.kind === 'door'
            || entry.kind === 'obstacle'
            || entry.kind === 'furniture'
            || entry.kind === 'terrain'
            ? entry.kind
            : 'room'
          return [{
            label: cleanText(entry.label, 'VTT feature label', 80, false) || kind,
            kind,
            x_ft: snap(entry.x_ft, 0, width),
            y_ft: snap(entry.y_ft, 0, height),
            width_ft: Math.max(5, snap(entry.width_ft, 5, width)),
            height_ft: Math.max(5, snap(entry.height_ft, 5, height)),
          }]
        })
      : [],
    actors: Array.isArray(value.actors)
      ? value.actors.slice(0, 40).flatMap((entry) => {
          if (!plainObject(entry)) return []
          const name = cleanText(entry.name, 'VTT actor name', 80, false)
          if (!name) return []
          return [{
            name,
            side: entry.side === 'ally' ? 'ally' : 'enemy',
            visual_tags: Array.isArray(entry.visual_tags)
              ? entry.visual_tags.filter((tag): tag is string => typeof tag === 'string')
                  .map((tag) => tag.replace(/\s+/g, ' ').trim().slice(0, 80))
                  .filter(Boolean)
                  .slice(0, 10)
              : [],
            x_ft: snap(entry.x_ft, width - 10, width),
            y_ft: snap(entry.y_ft, 5, height),
          }]
        })
      : [],
    asset_search_terms: Array.isArray(value.asset_search_terms)
      ? value.asset_search_terms.filter((term): term is string => typeof term === 'string')
          .map((term) => term.replace(/\s+/g, ' ').trim().slice(0, 80))
          .filter(Boolean)
          .slice(0, 16)
      : [],
  }
}

function normalizeEnemies(value: unknown) {
  if (!Array.isArray(value) || value.length > MAX_ENEMIES) {
    throw new FoundryIntegrationError('The VTT enemy list is not valid.', 400, 'invalid_foundry_encounter')
  }

  return value.map((entry, index) => {
    if (!plainObject(entry)) {
      throw new FoundryIntegrationError(`Enemy ${index + 1} is not valid.`, 400, 'invalid_foundry_encounter')
    }

    return {
      combatantId: cleanText(entry.combatantId, `Enemy ${index + 1} ID`, 180),
      displayName: cleanText(entry.displayName, `Enemy ${index + 1} name`, 80),
      initiative: finiteNumber(entry.initiative),
    }
  })
}

function controllerActive(lastSeenAt: unknown) {
  if (typeof lastSeenAt !== 'string') return false
  const seen = Date.parse(lastSeenAt)
  return Number.isFinite(seen) && Date.now() - seen <= CONTROLLER_ACTIVE_MS
}

export async function getFoundryCampaignStatus(user: User, rawCampaignId: unknown) {
  const campaignId = cleanUuid(rawCampaignId, 'Campaign ID')
  await requireMembership(user.id, campaignId)
  const connection = await activeConnection(campaignId)

  if (!connection) {
    return {
      connected: false as const,
      controllerActive: false,
      campaignId,
      launchUrl: null,
      worldLabel: null,
      controllerName: null,
      lastSeenAt: null,
    }
  }

  return {
    connected: true as const,
    controllerActive: controllerActive(connection.last_seen_at),
    campaignId,
    connectionId: connection.id as string,
    launchUrl: (connection.launch_url as string | null) || null,
    worldLabel: (connection.foundry_world_label as string | null) || 'Foundry world',
    controllerName: (connection.controller_foundry_user_name as string | null) || 'Foundry GM',
    lastSeenAt: connection.last_seen_at as string,
  }
}

export async function createFoundryCombatEncounter(user: User, input: unknown) {
  if (!plainObject(input)) {
    throw new FoundryIntegrationError('The VTT combat request is not valid.', 400, 'invalid_foundry_encounter')
  }

  const campaignId = cleanUuid(input.campaignId, 'Campaign ID')
  await requireMembership(user.id, campaignId)

  const connection = await activeConnection(campaignId)
  if (!connection) {
    throw new FoundryIntegrationError(
      'No Foundry world is connected to this campaign.',
      409,
      'foundry_not_connected',
    )
  }

  const admin = createAdminClient()
  const { data: campaign, error: campaignError } = await admin
    .from('campaigns')
    .select('id, name')
    .eq('id', campaignId)
    .is('deleted_at', null)
    .maybeSingle()

  if (campaignError) throw new FoundryIntegrationError(campaignError.message, 503, 'database_unavailable')
  if (!campaign) throw new FoundryIntegrationError('That campaign is not available.', 404, 'campaign_not_found')

  const turnNumber = Math.max(0, safeInteger(input.turnNumber))
  const party = normalizeParty(input.party)
  const enemies = normalizeEnemies(input.enemies)
  const sceneLabel = cleanText(input.sceneLabel, 'Scene label', 160, false) || 'Combat'
  const sceneSummary = cleanText(input.sceneSummary, 'Scene summary', 1200, false)
  const vttSetup = normalizeVttSetup(input.vttSetup)

  const payload = {
    version: 1,
    campaignId,
    campaignName: campaign.name as string,
    turnNumber,
    scene: {
      label: sceneLabel,
      summary: sceneSummary,
    },
    vttSetup,
    party,
    enemies,
  }

  const { data: existing, error: existingError } = await admin
    .from('foundry_combat_encounters')
    .select('id, status, created_at')
    .eq('connection_id', connection.id)
    .eq('turn_number', turnNumber)
    .maybeSingle()

  if (existingError) throw new FoundryIntegrationError(existingError.message, 503, 'database_unavailable')

  if (existing && existing.status !== 'failed') {
    return {
      encounterId: existing.id as string,
      status: existing.status as string,
      createdAt: existing.created_at as string,
      launchUrl: (connection.launch_url as string | null) || null,
    }
  }

  const now = new Date().toISOString()

  if (existing) {
    const { data: retried, error: retryError } = await admin
      .from('foundry_combat_encounters')
      .update({
        status: 'pending',
        payload,
        foundry_scene_id: null,
        error_message: null,
        claimed_at: null,
        rendered_at: null,
        updated_at: now,
      })
      .eq('id', existing.id)
      .select('id, status, created_at')
      .single()

    if (retryError || !retried) {
      throw new FoundryIntegrationError(retryError?.message || 'Could not retry the Foundry combat.', 503, 'database_unavailable')
    }

    return {
      encounterId: retried.id as string,
      status: retried.status as string,
      createdAt: retried.created_at as string,
      launchUrl: (connection.launch_url as string | null) || null,
    }
  }

  const { data, error } = await admin
    .from('foundry_combat_encounters')
    .insert({
      connection_id: connection.id,
      campaign_id: campaignId,
      requested_by_user_id: user.id,
      turn_number: turnNumber,
      status: 'pending',
      payload,
      updated_at: now,
    })
    .select('id, status, created_at')
    .single()

  if (error || !data) {
    throw new FoundryIntegrationError(error?.message || 'Could not queue the Foundry combat.', 503, 'database_unavailable')
  }

  return {
    encounterId: data.id as string,
    status: data.status as string,
    createdAt: data.created_at as string,
    launchUrl: (connection.launch_url as string | null) || null,
  }
}

export async function claimFoundryCombatEncounter(request: Request, input: unknown) {
  const { connection, campaign } = await requireFoundrySession(request)
  const body = plainObject(input) ? input : {}
  const launchUrl = normalizeLaunchUrl(body.launchUrl)
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const connectionUpdate: Record<string, string> = {
    last_seen_at: now,
    updated_at: now,
  }
  if (launchUrl) connectionUpdate.launch_url = launchUrl

  const { error: connectionError } = await admin
    .from('foundry_connections')
    .update(connectionUpdate)
    .eq('id', connection.id)

  if (connectionError) throw new FoundryIntegrationError(connectionError.message, 503, 'database_unavailable')

  const selection = 'id, campaign_id, turn_number, status, payload, created_at, claimed_at'

  const { data: claimedAlready, error: claimedError } = await admin
    .from('foundry_combat_encounters')
    .select(selection)
    .eq('connection_id', connection.id)
    .eq('campaign_id', campaign.id)
    .eq('status', 'claimed')
    .order('claimed_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (claimedError) throw new FoundryIntegrationError(claimedError.message, 503, 'database_unavailable')
  if (claimedAlready) {
    return {
      connected: true,
      campaignId: campaign.id as string,
      encounter: claimedAlready,
    }
  }

  const { data: pending, error: pendingError } = await admin
    .from('foundry_combat_encounters')
    .select(selection)
    .eq('connection_id', connection.id)
    .eq('campaign_id', campaign.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (pendingError) throw new FoundryIntegrationError(pendingError.message, 503, 'database_unavailable')
  if (!pending) {
    return {
      connected: true,
      campaignId: campaign.id as string,
      encounter: null,
    }
  }

  const { data: claimed, error: claimError } = await admin
    .from('foundry_combat_encounters')
    .update({
      status: 'claimed',
      claimed_at: now,
      updated_at: now,
    })
    .eq('id', pending.id)
    .eq('status', 'pending')
    .select(selection)
    .maybeSingle()

  if (claimError) throw new FoundryIntegrationError(claimError.message, 503, 'database_unavailable')

  return {
    connected: true,
    campaignId: campaign.id as string,
    encounter: claimed ?? null,
  }
}

export async function reportFoundryCombatEncounter(
  request: Request,
  rawEncounterId: unknown,
  input: unknown,
) {
  const encounterId = cleanUuid(rawEncounterId, 'Encounter ID')
  const { connection, campaign } = await requireFoundrySession(request)

  if (!plainObject(input) || (input.status !== 'rendered' && input.status !== 'failed')) {
    throw new FoundryIntegrationError('The Foundry encounter result is not valid.', 400, 'invalid_foundry_encounter_result')
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const status = input.status
  const foundrySceneId = status === 'rendered'
    ? cleanText(input.foundrySceneId, 'Foundry Scene ID', 180)
    : null
  const errorMessage = status === 'failed'
    ? cleanText(input.errorMessage, 'Foundry render error', 1000, false) || 'Foundry could not render the encounter.'
    : null

  const { data, error } = await admin
    .from('foundry_combat_encounters')
    .update({
      status,
      foundry_scene_id: foundrySceneId,
      error_message: errorMessage,
      rendered_at: status === 'rendered' ? now : null,
      updated_at: now,
    })
    .eq('id', encounterId)
    .eq('connection_id', connection.id)
    .eq('campaign_id', campaign.id)
    .in('status', ['pending', 'claimed'])
    .select('id, status, foundry_scene_id, error_message, updated_at')
    .maybeSingle()

  if (error) throw new FoundryIntegrationError(error.message, 503, 'database_unavailable')
  if (!data) throw new FoundryIntegrationError('That Foundry encounter is no longer open.', 409, 'encounter_not_open')

  return {
    encounterId: data.id as string,
    status: data.status as string,
    foundrySceneId: data.foundry_scene_id as string | null,
    errorMessage: data.error_message as string | null,
    updatedAt: data.updated_at as string,
  }
}

export async function getFoundryCombatEncounterStatus(user: User, rawEncounterId: unknown) {
  const encounterId = cleanUuid(rawEncounterId, 'Encounter ID')
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('foundry_combat_encounters')
    .select('id, campaign_id, status, foundry_scene_id, error_message, created_at, updated_at')
    .eq('id', encounterId)
    .maybeSingle()

  if (error) throw new FoundryIntegrationError(error.message, 503, 'database_unavailable')
  if (!data) throw new FoundryIntegrationError('That Foundry encounter was not found.', 404, 'encounter_not_found')

  await requireMembership(user.id, data.campaign_id as string)

  return {
    encounterId: data.id as string,
    campaignId: data.campaign_id as string,
    status: data.status as string,
    foundrySceneId: data.foundry_scene_id as string | null,
    errorMessage: data.error_message as string | null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  }
}
