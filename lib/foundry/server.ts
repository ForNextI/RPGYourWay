import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const USER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const PAIRING_LIFETIME_MS = 10 * 60 * 1000
const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000

type PairingStartInput = {
  integratorWorldId?: unknown
  foundryUserId?: unknown
  foundryUserName?: unknown
  foundryWorldLabel?: unknown
}

type GrantPayload = {
  v: 1
  connectionId: string
  campaignId: string
  integratorWorldId: string
  foundryUserId: string
  exp: number
}

export class FoundryIntegrationError extends Error {
  status: number
  code: string

  constructor(message: string, status = 500, code = 'foundry_integration_error') {
    super(message)
    this.name = 'FoundryIntegrationError'
    this.status = status
    this.code = code
  }
}

export function foundryCorsHeaders(extra: HeadersInit = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-store',
    ...extra,
  }
}

export function foundryErrorResponse(error: unknown, cors = false) {
  const status = error instanceof FoundryIntegrationError ? error.status : 500
  const code = error instanceof FoundryIntegrationError ? error.code : 'foundry_integration_error'
  const message = error instanceof Error ? error.message : 'Foundry integration request failed.'
  return Response.json(
    { error: message, code },
    {
      status,
      headers: cors ? foundryCorsHeaders() : { 'Cache-Control': 'no-store' },
    },
  )
}

export async function requireFoundryWebUser(): Promise<User> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new FoundryIntegrationError('Sign in to connect Foundry VTT.', 401, 'authentication_required')
  return data.user
}

function cleanRequiredText(value: unknown, label: string, maxLength: number) {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  if (!text) throw new FoundryIntegrationError(`${label} is required.`, 400, 'invalid_pairing_request')
  return text.slice(0, maxLength)
}

function cleanOptionalText(value: unknown, maxLength: number) {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  return text ? text.slice(0, maxLength) : null
}

function requireUuid(value: unknown, label: string) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!UUID_PATTERN.test(text)) throw new FoundryIntegrationError(`${label} is not valid.`, 400, 'invalid_identifier')
  return text
}

function generateUserCode() {
  let raw = ''
  for (let index = 0; index < 8; index += 1) {
    raw += USER_CODE_ALPHABET[randomInt(0, USER_CODE_ALPHABET.length)]
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`
}

function normalizeUserCode(value: unknown) {
  const raw = typeof value === 'string' ? value.toUpperCase().replace(/[^A-Z0-9]/g, '') : ''
  if (raw.length !== 8) throw new FoundryIntegrationError('That Foundry connection code is not valid.', 400, 'invalid_pairing_code')
  return `${raw.slice(0, 4)}-${raw.slice(4)}`
}

function signingSecret() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new FoundryIntegrationError('Foundry integration signing is not configured.', 503, 'integration_not_configured')
  return secret
}

function encodeJson(value: object) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}

function sign(encodedPayload: string) {
  return createHmac('sha256', signingSecret()).update(encodedPayload).digest('base64url')
}

function issueGrant(payload: GrantPayload) {
  const encoded = encodeJson(payload)
  return `${encoded}.${sign(encoded)}`
}

function parseGrant(token: string): GrantPayload {
  const parts = token.split('.')
  if (parts.length !== 2) throw new FoundryIntegrationError('The Foundry session grant is not valid.', 401, 'invalid_session_grant')

  const [encoded, suppliedSignature] = parts
  const expectedSignature = sign(encoded)

  const supplied = Buffer.from(suppliedSignature, 'base64url')
  const expected = Buffer.from(expectedSignature, 'base64url')
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new FoundryIntegrationError('The Foundry session grant is not valid.', 401, 'invalid_session_grant')
  }

  let payload: unknown
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
  } catch {
    throw new FoundryIntegrationError('The Foundry session grant is not valid.', 401, 'invalid_session_grant')
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new FoundryIntegrationError('The Foundry session grant is not valid.', 401, 'invalid_session_grant')
  }

  const candidate = payload as Partial<GrantPayload>
  if (
    candidate.v !== 1
    || typeof candidate.connectionId !== 'string'
    || typeof candidate.campaignId !== 'string'
    || typeof candidate.integratorWorldId !== 'string'
    || typeof candidate.foundryUserId !== 'string'
    || typeof candidate.exp !== 'number'
  ) {
    throw new FoundryIntegrationError('The Foundry session grant is not valid.', 401, 'invalid_session_grant')
  }

  if (Date.now() >= candidate.exp) throw new FoundryIntegrationError('The Foundry session grant has expired.', 401, 'session_grant_expired')
  return candidate as GrantPayload
}

async function activeCampaignMembership(userId: string, campaignId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('campaign_members')
    .select('campaign_id')
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)
    .eq('membership_status', 'active')
    .maybeSingle()
  if (error) throw new FoundryIntegrationError(error.message, 503, 'database_unavailable')
  return Boolean(data)
}

export async function startFoundryPairing(input: PairingStartInput, origin: string) {
  const integratorWorldId = cleanRequiredText(input.integratorWorldId, 'Integrator world ID', 160)
  const foundryUserId = cleanRequiredText(input.foundryUserId, 'Foundry user ID', 160)
  const foundryUserName = cleanOptionalText(input.foundryUserName, 160)
  const foundryWorldLabel = cleanOptionalText(input.foundryWorldLabel, 160)
  const admin = createAdminClient()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + PAIRING_LIFETIME_MS).toISOString()

  await admin
    .from('foundry_pairing_requests')
    .update({ status: 'expired' })
    .eq('integrator_world_id', integratorWorldId)
    .eq('status', 'pending')

  let row: { id: string; user_code: string; expires_at: string } | null = null
  let lastError: Error | null = null

  for (let attempt = 0; attempt < 5 && !row; attempt += 1) {
    const userCode = generateUserCode()
    const { data, error } = await admin
      .from('foundry_pairing_requests')
      .insert({
        user_code: userCode,
        integrator_world_id: integratorWorldId,
        foundry_user_id: foundryUserId,
        foundry_user_name: foundryUserName,
        foundry_world_label: foundryWorldLabel,
        status: 'pending',
        expires_at: expiresAt,
      })
      .select('id, user_code, expires_at')
      .single()

    if (!error && data) {
      row = data as { id: string; user_code: string; expires_at: string }
      break
    }

    lastError = new Error(error?.message || 'Unable to create Foundry pairing request.')
  }

  if (!row) throw new FoundryIntegrationError(lastError?.message || 'Unable to create Foundry pairing request.', 503, 'pairing_unavailable')

  const verificationUrl = new URL('/foundry/connect', origin)
  verificationUrl.searchParams.set('code', row.user_code)

  return {
    pairId: row.id,
    userCode: row.user_code,
    verificationUrl: verificationUrl.toString(),
    expiresAt: row.expires_at,
  }
}

export async function getFoundryPairingStatus(rawPairId: unknown) {
  const pairId = requireUuid(rawPairId, 'Pairing ID')
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('foundry_pairing_requests')
    .select('id, status, connection_id, campaign_id, integrator_world_id, foundry_user_id, expires_at, session_expires_at')
    .eq('id', pairId)
    .maybeSingle()

  if (error) throw new FoundryIntegrationError(error.message, 503, 'database_unavailable')
  if (!data) throw new FoundryIntegrationError('That Foundry pairing request was not found.', 404, 'pairing_not_found')

  if (data.status === 'pending' && Date.now() >= Date.parse(data.expires_at)) {
    await admin.from('foundry_pairing_requests').update({ status: 'expired' }).eq('id', pairId).eq('status', 'pending')
    return { status: 'expired' as const }
  }

  if (data.status !== 'approved') return { status: data.status as 'pending' | 'denied' | 'expired' }

  if (!data.connection_id || !data.campaign_id || !data.session_expires_at) {
    throw new FoundryIntegrationError('That Foundry connection is incomplete.', 409, 'incomplete_connection')
  }

  const sessionExpiresAt = Date.parse(data.session_expires_at)
  if (!Number.isFinite(sessionExpiresAt) || Date.now() >= sessionExpiresAt) return { status: 'expired' as const }

  return {
    status: 'approved' as const,
    sessionGrant: issueGrant({
      v: 1,
      connectionId: data.connection_id,
      campaignId: data.campaign_id,
      integratorWorldId: data.integrator_world_id,
      foundryUserId: data.foundry_user_id,
      exp: sessionExpiresAt,
    }),
  }
}

export async function approveFoundryPairing(user: User, rawCode: unknown, rawCampaignId: unknown) {
  const userCode = normalizeUserCode(rawCode)
  const campaignId = requireUuid(rawCampaignId, 'Campaign ID')
  const admin = createAdminClient()

  if (!await activeCampaignMembership(user.id, campaignId)) {
    throw new FoundryIntegrationError('That campaign is not available to this account.', 404, 'campaign_not_found')
  }

  const { data: campaign, error: campaignError } = await admin
    .from('campaigns')
    .select('id, name, mode')
    .eq('id', campaignId)
    .is('deleted_at', null)
    .maybeSingle()
  if (campaignError) throw new FoundryIntegrationError(campaignError.message, 503, 'database_unavailable')
  if (!campaign) throw new FoundryIntegrationError('That campaign is not available.', 404, 'campaign_not_found')

  const { data: pairing, error: pairingError } = await admin
    .from('foundry_pairing_requests')
    .select('id, status, expires_at, integrator_world_id, foundry_user_id, foundry_user_name, foundry_world_label')
    .eq('user_code', userCode)
    .maybeSingle()
  if (pairingError) throw new FoundryIntegrationError(pairingError.message, 503, 'database_unavailable')
  if (!pairing) throw new FoundryIntegrationError('That Foundry connection code was not found.', 404, 'pairing_not_found')
  if (pairing.status !== 'pending') throw new FoundryIntegrationError('That Foundry connection code has already been used or expired.', 409, 'pairing_not_pending')
  if (Date.now() >= Date.parse(pairing.expires_at)) {
    await admin.from('foundry_pairing_requests').update({ status: 'expired' }).eq('id', pairing.id)
    throw new FoundryIntegrationError('That Foundry connection code has expired. Start a new connection from Foundry.', 410, 'pairing_expired')
  }

  const now = new Date().toISOString()
  const sessionExpiresAt = new Date(Date.now() + SESSION_LIFETIME_MS).toISOString()

  const { data: connection, error: connectionError } = await admin
    .from('foundry_connections')
    .upsert({
      campaign_id: campaignId,
      integrator_world_id: pairing.integrator_world_id,
      foundry_world_label: pairing.foundry_world_label,
      controller_foundry_user_id: pairing.foundry_user_id,
      controller_foundry_user_name: pairing.foundry_user_name,
      linked_by_user_id: user.id,
      status: 'active',
      updated_at: now,
      last_seen_at: now,
    }, { onConflict: 'integrator_world_id' })
    .select('id')
    .single()
  if (connectionError || !connection) throw new FoundryIntegrationError(connectionError?.message || 'Unable to save the Foundry connection.', 503, 'database_unavailable')

  const { data: approved, error: approvalError } = await admin
    .from('foundry_pairing_requests')
    .update({
      status: 'approved',
      approved_by_user_id: user.id,
      campaign_id: campaignId,
      connection_id: connection.id,
      approved_at: now,
      session_expires_at: sessionExpiresAt,
    })
    .eq('id', pairing.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()
  if (approvalError) throw new FoundryIntegrationError(approvalError.message, 503, 'database_unavailable')
  if (!approved) throw new FoundryIntegrationError('That Foundry connection code changed before it could be approved.', 409, 'pairing_changed')

  return {
    connected: true,
    campaignId,
    campaignName: campaign.name as string,
    campaignMode: campaign.mode as string,
    worldLabel: pairing.foundry_world_label || 'Foundry world',
    foundryUserName: pairing.foundry_user_name || 'Foundry GM',
  }
}

function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  if (!match) throw new FoundryIntegrationError('A Foundry session grant is required.', 401, 'missing_session_grant')
  return match[1].trim()
}

export async function requireFoundrySession(request: Request) {
  const grant = parseGrant(bearerToken(request))
  const admin = createAdminClient()

  const { data: connection, error } = await admin
    .from('foundry_connections')
    .select('id, campaign_id, integrator_world_id, foundry_world_label, controller_foundry_user_id, controller_foundry_user_name, linked_by_user_id, status')
    .eq('id', grant.connectionId)
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw new FoundryIntegrationError(error.message, 503, 'database_unavailable')
  if (!connection) throw new FoundryIntegrationError('That Foundry connection is no longer active.', 401, 'connection_revoked')

  if (
    connection.campaign_id !== grant.campaignId
    || connection.integrator_world_id !== grant.integratorWorldId
    || connection.controller_foundry_user_id !== grant.foundryUserId
  ) {
    throw new FoundryIntegrationError('The Foundry session grant does not match this connection.', 401, 'session_grant_mismatch')
  }

  const { data: campaign, error: campaignError } = await admin
    .from('campaigns')
    .select('id, name, mode, revision, updated_at')
    .eq('id', connection.campaign_id)
    .is('deleted_at', null)
    .maybeSingle()
  if (campaignError) throw new FoundryIntegrationError(campaignError.message, 503, 'database_unavailable')
  if (!campaign) throw new FoundryIntegrationError('The connected RPG Your Way campaign is not available.', 404, 'campaign_not_found')

  await admin
    .from('foundry_connections')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', connection.id)

  return {
    connection,
    campaign,
  }
}

export async function listUserFoundryConnections(userId: string) {
  const admin = createAdminClient()
  const { data: memberships, error: membershipError } = await admin
    .from('campaign_members')
    .select('campaign_id')
    .eq('user_id', userId)
    .eq('membership_status', 'active')
  if (membershipError) throw new FoundryIntegrationError(membershipError.message, 503, 'database_unavailable')

  const campaignIds = (memberships ?? []).map((row: { campaign_id: string }) => row.campaign_id)
  if (!campaignIds.length) return []

  const { data: connections, error: connectionError } = await admin
    .from('foundry_connections')
    .select('id, campaign_id, integrator_world_id, foundry_world_label, controller_foundry_user_name, status, created_at, updated_at, last_seen_at')
    .in('campaign_id', campaignIds)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
  if (connectionError) throw new FoundryIntegrationError(connectionError.message, 503, 'database_unavailable')
  if (!connections?.length) return []

  const connectedCampaignIds = [...new Set(connections.map((row: { campaign_id: string }) => row.campaign_id))]
  const { data: campaigns, error: campaignError } = await admin
    .from('campaigns')
    .select('id, name, mode')
    .in('id', connectedCampaignIds)
    .is('deleted_at', null)
  if (campaignError) throw new FoundryIntegrationError(campaignError.message, 503, 'database_unavailable')

  const campaignMap = new Map((campaigns ?? []).map((campaign: { id: string; name: string; mode: string }) => [campaign.id, campaign]))

  return connections.flatMap((connection: {
    id: string
    campaign_id: string
    integrator_world_id: string
    foundry_world_label: string | null
    controller_foundry_user_name: string | null
    status: string
    created_at: string
    updated_at: string
    last_seen_at: string
  }) => {
    const campaign = campaignMap.get(connection.campaign_id)
    if (!campaign) return []
    return [{
      id: connection.id,
      campaign_id: connection.campaign_id,
      campaign_name: campaign.name,
      campaign_mode: campaign.mode,
      integrator_world_id: connection.integrator_world_id,
      world_label: connection.foundry_world_label || 'Foundry world',
      controller_name: connection.controller_foundry_user_name || 'Foundry GM',
      last_seen_at: connection.last_seen_at,
      updated_at: connection.updated_at,
    }]
  })
}
