#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path.cwd()


def fail(message):
    raise SystemExit(f"ERROR: {message}")


def read(rel):
    path = ROOT / rel
    if not path.exists():
        fail(f"Missing expected file: {rel}")
    return path.read_text(encoding="utf-8")


def write(rel, text):
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def replace_once(rel, old, new):
    text = read(rel)
    count = text.count(old)
    if count != 1:
        fail(f"{rel}: expected exactly one match, found {count}")
    write(rel, text.replace(old, new, 1))


def replace_all_checked(rel, old, new, minimum=1):
    text = read(rel)
    count = text.count(old)
    if count < minimum:
        fail(f"{rel}: expected at least {minimum} matches for {old!r}, found {count}")
    write(rel, text.replace(old, new))


def insert_after(rel, marker, addition):
    text = read(rel)
    count = text.count(marker)
    if count != 1:
        fail(f"{rel}: expected exactly one insertion marker, found {count}")
    write(rel, text.replace(marker, marker + addition, 1))


def create_new(rel, text):
    path = ROOT / rel
    if path.exists():
        fail(f"{rel}: already exists; refusing to overwrite an unexpected file")
    write(rel, text)


pkg = json.loads(read("package.json"))
if pkg.get("version") != "2.12.0":
    fail(f"package.json version is {pkg.get('version')!r}; expected 2.12.0")
if pkg.get("rpgywVersion") != "2.12.0":
    fail(f"package.json rpgywVersion is {pkg.get('rpgywVersion')!r}; expected 2.12.0")
pkg["version"] = "2.12.1"
pkg["rpgywVersion"] = "2.12.1"
write("package.json", json.dumps(pkg, indent=2) + "\n")

replace_once(
    "lib/version.ts",
    "export const APP_VERSION = '2.12.0'\n",
    "export const APP_VERSION = '2.12.1'\n",
)

# Server: durable signed device grants silently mint short working sessions.
# Revocation remains server-authoritative because every refresh re-checks the
# active Foundry connection or player-link row. No SQL migration is required.
replace_once(
    "lib/foundry/server.ts",
    "const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000\n",
    "const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000\n"
    "const DEVICE_GRANT_LIFETIME_MS = 180 * 24 * 60 * 60 * 1000\n"
    "const CONTROLLER_ACTIVE_MS = 15_000\n",
)

replace_once(
    "lib/foundry/server.ts",
    """type GrantPayload = {
  v: 1
  connectionId: string
  campaignId: string
  integratorWorldId: string
  foundryUserId: string
  exp: number
  scope?: 'controller' | 'player'
  playerLinkId?: string
}
""",
    """type GrantPayload = {
  v: 1
  kind?: 'session' | 'device'
  connectionId: string
  campaignId: string
  integratorWorldId: string
  foundryUserId: string
  exp: number
  scope?: 'controller' | 'player'
  playerLinkId?: string
}
""",
)

replace_once(
    "lib/foundry/server.ts",
    """    candidate.v !== 1
    || typeof candidate.connectionId !== 'string'
""",
    """    candidate.v !== 1
    || (
      candidate.kind !== undefined
      && candidate.kind !== 'session'
      && candidate.kind !== 'device'
    )
    || typeof candidate.connectionId !== 'string'
""",
)

replace_once(
    "lib/foundry/server.ts",
    """  return {
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
""",
    """  return {
    status: 'approved' as const,
    sessionGrant: issueGrant({
      v: 1,
      kind: 'session',
      scope: 'controller',
      connectionId: data.connection_id,
      campaignId: data.campaign_id,
      integratorWorldId: data.integrator_world_id,
      foundryUserId: data.foundry_user_id,
      exp: sessionExpiresAt,
    }),
    deviceGrant: issueGrant({
      v: 1,
      kind: 'device',
      scope: 'controller',
      connectionId: data.connection_id,
      campaignId: data.campaign_id,
      integratorWorldId: data.integrator_world_id,
      foundryUserId: data.foundry_user_id,
      exp: Date.now() + DEVICE_GRANT_LIFETIME_MS,
    }),
  }
}
""",
)

replace_once(
    "lib/foundry/server.ts",
    """  return {
    status: 'approved' as const,
    sessionGrant: issueGrant({
      v: 1,
      scope: 'player',
      playerLinkId: data.player_link_id,
      connectionId: data.connection_id,
      campaignId: data.campaign_id,
      integratorWorldId: data.integrator_world_id,
      foundryUserId: data.foundry_user_id,
      exp: sessionExpiresAt,
    }),
  }
}
""",
    """  return {
    status: 'approved' as const,
    sessionGrant: issueGrant({
      v: 1,
      kind: 'session',
      scope: 'player',
      playerLinkId: data.player_link_id,
      connectionId: data.connection_id,
      campaignId: data.campaign_id,
      integratorWorldId: data.integrator_world_id,
      foundryUserId: data.foundry_user_id,
      exp: sessionExpiresAt,
    }),
    deviceGrant: issueGrant({
      v: 1,
      kind: 'device',
      scope: 'player',
      playerLinkId: data.player_link_id,
      connectionId: data.connection_id,
      campaignId: data.campaign_id,
      integratorWorldId: data.integrator_world_id,
      foundryUserId: data.foundry_user_id,
      exp: Date.now() + DEVICE_GRANT_LIFETIME_MS,
    }),
  }
}
""",
)

bearer_marker = """function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || ''
  const match = authorization.match(/^Bearer\\s+(.+)$/i)
  if (!match) throw new FoundryIntegrationError('A Foundry session grant is required.', 401, 'missing_session_grant')
  return match[1].trim()
}
"""

refresh_code = r'''

function renewedFoundryGrants(grant: GrantPayload) {
  const now = Date.now()

  return {
    sessionGrant: issueGrant({
      v: 1,
      kind: 'session',
      scope: grant.scope,
      playerLinkId: grant.playerLinkId,
      connectionId: grant.connectionId,
      campaignId: grant.campaignId,
      integratorWorldId: grant.integratorWorldId,
      foundryUserId: grant.foundryUserId,
      exp: now + SESSION_LIFETIME_MS,
    }),
    deviceGrant: issueGrant({
      v: 1,
      kind: 'device',
      scope: grant.scope,
      playerLinkId: grant.playerLinkId,
      connectionId: grant.connectionId,
      campaignId: grant.campaignId,
      integratorWorldId: grant.integratorWorldId,
      foundryUserId: grant.foundryUserId,
      exp: now + DEVICE_GRANT_LIFETIME_MS,
    }),
  }
}

export async function refreshFoundryDeviceSession(request: Request) {
  const grant = parseGrant(bearerToken(request))

  if (grant.kind !== 'device') {
    throw new FoundryIntegrationError(
      'A persistent Foundry device grant is required.',
      403,
      'device_grant_required',
    )
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  if (grant.scope === 'player') {
    if (!grant.playerLinkId) {
      throw new FoundryIntegrationError(
        'That Foundry player device grant is incomplete.',
        401,
        'invalid_device_grant',
      )
    }

    const { data: playerLink, error: playerLinkError } = await admin
      .from('foundry_user_links')
      .select('id, connection_id, foundry_user_id, status')
      .eq('id', grant.playerLinkId)
      .eq('status', 'active')
      .maybeSingle()

    if (playerLinkError) {
      throw new FoundryIntegrationError(playerLinkError.message, 503, 'database_unavailable')
    }

    if (
      !playerLink
      || playerLink.connection_id !== grant.connectionId
      || playerLink.foundry_user_id !== grant.foundryUserId
    ) {
      throw new FoundryIntegrationError(
        'That Foundry player link is no longer active.',
        401,
        'player_link_revoked',
      )
    }

    const { data: connection, error: connectionError } = await admin
      .from('foundry_connections')
      .select('id, campaign_id, integrator_world_id, status')
      .eq('id', grant.connectionId)
      .eq('status', 'active')
      .maybeSingle()

    if (connectionError) {
      throw new FoundryIntegrationError(connectionError.message, 503, 'database_unavailable')
    }

    if (
      !connection
      || connection.campaign_id !== grant.campaignId
      || connection.integrator_world_id !== grant.integratorWorldId
    ) {
      throw new FoundryIntegrationError(
        'The Foundry player device grant does not match this world.',
        401,
        'device_grant_mismatch',
      )
    }

    await admin
      .from('foundry_user_links')
      .update({ last_seen_at: now })
      .eq('id', playerLink.id)

    return {
      scope: 'player' as const,
      ...renewedFoundryGrants(grant),
    }
  }

  const { data: connection, error: connectionError } = await admin
    .from('foundry_connections')
    .select('id, campaign_id, integrator_world_id, controller_foundry_user_id, status')
    .eq('id', grant.connectionId)
    .eq('status', 'active')
    .maybeSingle()

  if (connectionError) {
    throw new FoundryIntegrationError(connectionError.message, 503, 'database_unavailable')
  }

  if (
    !connection
    || connection.campaign_id !== grant.campaignId
    || connection.integrator_world_id !== grant.integratorWorldId
    || connection.controller_foundry_user_id !== grant.foundryUserId
  ) {
    throw new FoundryIntegrationError(
      'That Foundry controller connection is no longer active.',
      401,
      'connection_revoked',
    )
  }

  await admin
    .from('foundry_connections')
    .update({ last_seen_at: now })
    .eq('id', connection.id)

  return {
    scope: 'controller' as const,
    ...renewedFoundryGrants(grant),
  }
}
'''
insert_after("lib/foundry/server.ts", bearer_marker, refresh_code)

replace_once(
    "lib/foundry/server.ts",
    """export async function requireFoundrySession(request: Request) {
  const grant = parseGrant(bearerToken(request))
  if (grant.scope === 'player') {
""",
    """export async function requireFoundrySession(request: Request) {
  const grant = parseGrant(bearerToken(request))
  if (grant.kind === 'device' || grant.scope === 'player') {
""",
)

replace_once(
    "lib/foundry/server.ts",
    """export async function requireFoundryPlayerSession(request: Request) {
  const grant = parseGrant(bearerToken(request))

  if (grant.scope !== 'player' || !grant.playerLinkId) {
""",
    """export async function requireFoundryPlayerSession(request: Request) {
  const grant = parseGrant(bearerToken(request))

  if (grant.kind === 'device' || grant.scope !== 'player' || !grant.playerLinkId) {
""",
)

replace_once(
    "lib/foundry/server.ts",
    """      controller_name: connection.controller_foundry_user_name || 'Foundry GM',
      last_seen_at: connection.last_seen_at,
      updated_at: connection.updated_at,
""",
    """      controller_name: connection.controller_foundry_user_name || 'Foundry GM',
      controller_active: (() => {
        const seen = Date.parse(connection.last_seen_at)
        return Number.isFinite(seen) && Date.now() - seen <= CONTROLLER_ACTIVE_MS
      })(),
      last_seen_at: connection.last_seen_at,
      updated_at: connection.updated_at,
""",
)

create_new(
    "app/api/integrations/foundry/session/refresh/route.ts",
    """import {
  foundryCorsHeaders,
  foundryErrorResponse,
  refreshFoundryDeviceSession,
} from '@/lib/foundry/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: foundryCorsHeaders() })
}

export async function POST(request: Request) {
  try {
    const result = await refreshFoundryDeviceSession(request)
    return Response.json(result, { headers: foundryCorsHeaders() })
  } catch (error) {
    return foundryErrorResponse(error, true)
  }
}
""",
)

write(
    "components/foundry/FoundryConnectionsPanel.tsx",
    """'use client'

import { useEffect, useState } from 'react'
import { Cable, LoaderCircle } from 'lucide-react'

type FoundryConnection = {
  id: string
  campaign_id: string
  campaign_name: string
  campaign_mode: string
  integrator_world_id: string
  world_label: string
  controller_name: string
  controller_active: boolean
  last_seen_at: string
}

const REFRESH_INTERVAL_MS = 10_000

export function FoundryConnectionsPanel() {
  const [loading, setLoading] = useState(true)
  const [connections, setConnections] = useState<FoundryConnection[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const response = await fetch('/api/integrations/foundry/connections', { cache: 'no-store' })
        const body = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(typeof body.error === 'string' ? body.error : 'Could not load Foundry connections.')
        }
        if (!cancelled) {
          setConnections(Array.isArray(body.connections) ? body.connections : [])
          setError('')
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Could not load Foundry connections.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    const timer = window.setInterval(() => void load(), REFRESH_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  return (
    <section
      id="foundry-vtt"
      className="multiplayer-vtt-card scroll-mt-6"
      aria-labelledby="foundry-connections-heading"
    >
      <p className="kicker">Virtual tabletop</p>
      <h2 id="foundry-connections-heading">Foundry VTT</h2>
      <p>
        Pair a Foundry world to an RPG Your Way campaign once with <strong>/rpgyw connect</strong>.
        Each human links their own Foundry user once with <strong>/rpgyw link</strong>. After that,
        the Integrator normally restores its short-lived working sessions automatically whenever
        the paired World opens.
      </p>

      {loading ? (
        <p className="campaign-control-status" role="status">
          <LoaderCircle className="play-entry-spin" aria-hidden="true" />
          Loading Foundry connections…
        </p>
      ) : connections.length ? (
        <div className="campaign-member-list">
          {connections.map((connection) => (
            <div key={connection.id} className="campaign-member-row">
              <span>
                <strong>{connection.world_label}</strong>
                <small>
                  {connection.campaign_name} · controller {connection.controller_name} ·{' '}
                  {connection.controller_active
                    ? 'online now'
                    : `offline · last seen ${new Date(connection.last_seen_at).toLocaleString()}`}
                </small>
              </span>
              <span className="campaign-control-badge">
                {connection.controller_active ? 'Online' : 'Paired'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="multiplayer-empty-state">
          <Cable aria-hidden="true" />
          <p>No Foundry world is paired yet. Your normal RPG Your Way campaigns continue to work without Foundry.</p>
        </div>
      )}

      {error ? <p className="auth-message auth-message-error" role="alert">{error}</p> : null}
    </section>
  )
}
""",
)

replace_once(
    "components/foundry/VttCombatHandoff.tsx",
    """    void focusOrOpenFoundry(url, foundryStatus?.controllerActive === true)
      .then((focused) => {
        if (!focused && foundryStatus?.controllerActive) {
          setHandoffError(
            'Foundry is already active, but this browser will not let RPG Your Way focus that existing tab safely. Switch to the open Foundry tab instead; RPG Your Way will not reload it.',
          )
        }
      })
""",
    """    void focusOrOpenFoundry(url, false)
      .then((focused) => {
        if (!focused) {
          setHandoffError(
            'Your browser blocked the Foundry window. Allow pop-ups for RPG Your Way, or open Foundry normally. Desktop Foundry controllers can simply switch to Foundry.exe.',
          )
        }
      })
""",
)

replace_once(
    "components/foundry/VttCombatHandoff.tsx",
    "    launchNamedWindow('/campaigns', 'rpgyw-campaigns')\n",
    "    launchNamedWindow('/campaigns#foundry-vtt', 'rpgyw-campaigns')\n",
)

replace_all_checked("components/foundry/VttCombatHandoff.tsx", "VTT encounter ready", "Foundry combat ready")
replace_all_checked("components/foundry/VttCombatHandoff.tsx", "Preparing VTT encounter…", "Preparing Foundry combat…")
replace_all_checked("components/foundry/VttCombatHandoff.tsx", "Go to VTT", "Open Foundry in browser")
replace_all_checked("components/foundry/VttCombatHandoff.tsx", "Would you like to use VTT for this combat?", "Would you like to use Foundry for this combat?")
replace_all_checked("components/foundry/VttCombatHandoff.tsx", "Would you like to set up VTT for combat?", "Would you like to set up Foundry for combat?")
replace_all_checked("components/foundry/VttCombatHandoff.tsx", "Use VTT", "Use Foundry")
replace_all_checked("components/foundry/VttCombatHandoff.tsx", "VTT setup", "Foundry setup")

replace_once(
    "components/foundry/VttCombatHandoff.tsx",
    """                    The Foundry world is connected, but its controller is not currently checking in. Open the Foundry world. If the controller session expired, use <strong>/rpgyw connect</strong> once to reauthorize it.
""",
    """                    This Foundry world is paired, but its controller is currently offline. Open the paired World in Foundry. The Integrator should restore its working session automatically; use <strong>/rpgyw connect</strong> only if pairing needs repair.
""",
)

replace_once(
    "components/foundry/VttCombatHandoff.tsx",
    """                    Foundry has not reported its browser address yet. Open the Foundry 2.8.0 world as the controller and leave it open for a few seconds.
""",
    """                    Foundry has not reported a browser join address yet. Open the paired World as the controller and leave it running for a few seconds.
""",
)

replace_once(
    "components/foundry/VttCombatHandoff.tsx",
    """                  RPG Your Way will queue this fight for your connected Foundry world. Foundry is the tactical board; RPG Your Way remains the campaign authority.
""",
    """                  RPG Your Way will queue this fight for your paired Foundry world. The desktop controller can switch to Foundry.exe manually; browser participants can use the separate Open Foundry in browser button. Foundry is the tactical board while RPG Your Way remains the campaign authority.
""",
)

replace_all_checked("scripts/validate-release.mts", "'2.12.0'", "'2.12.1'", minimum=3)
insert_after(
    "scripts/validate-release.mts",
    "  'app/api/integrations/foundry/connection/route.ts',\n",
    "  'app/api/integrations/foundry/session/refresh/route.ts',\n",
)

validator_marker = """has(foundryCombatHandoff, 'version: 2,', 'Foundry encounter payload v2')
"""
validator_addition = """const foundryConnectionsUi = read('components/foundry/FoundryConnectionsPanel.tsx')
const foundryServer = read('lib/foundry/server.ts')
has(foundryConnectionsUi, 'controller_active: boolean', 'Foundry paired/online distinction')
has(foundryConnectionsUi, 'id=\"foundry-vtt\"', 'Foundry campaign-page anchor')
lacks(foundryConnectionsUi, 'Foundry Integrator 2.8.0', 'stale Foundry Integrator UI version')
has(foundryCombatUi, 'Open Foundry in browser', 'explicit Foundry browser navigation')
has(foundryCombatUi, 'Use Foundry', 'explicit Foundry combat handoff')
lacks(foundryCombatUi, 'Foundry 2.8.0', 'stale Foundry combat UI version')
has(foundryServer, "kind?: 'session' | 'device'", 'Foundry durable device grant type')
has(foundryServer, 'refreshFoundryDeviceSession', 'Foundry automatic session refresh')
"""
insert_after("scripts/validate-release.mts", validator_marker, validator_addition)

print("✓ RPGYW 2.12.1 connection-workflow patch can be applied cleanly")
print("  persistent revocable Foundry device grants + automatic session renewal")
print("  campaign UI distinguishes Paired from Online")
print("  combat handoff says Use Foundry; browser navigation is explicit")
print("  Foundry setup links directly to the Foundry section")
print("  stale 2.8.0 UI copy removed")
print("  NO Supabase SQL migration")
