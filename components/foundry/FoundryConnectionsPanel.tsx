'use client'

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
  last_seen_at: string
}

export function FoundryConnectionsPanel() {
  const [loading, setLoading] = useState(true)
  const [connections, setConnections] = useState<FoundryConnection[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void fetch('/api/integrations/foundry/connections', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Could not load Foundry connections.')
        return body
      })
      .then((body) => {
        if (!cancelled) setConnections(Array.isArray(body.connections) ? body.connections : [])
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not load Foundry connections.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  return (
    <section className="multiplayer-vtt-card" aria-labelledby="foundry-connections-heading">
      <p className="kicker">Virtual tabletop</p>
      <h2 id="foundry-connections-heading">Foundry VTT</h2>
      <p>RPG Your Way Foundry Integrator 2.8.0 connects this campaign to a Foundry world for optional tactical combat. In Foundry chat, the Foundry license owner or designated technical GM types <strong>/rpgyw connect</strong> once for the world. Each human player then uses <strong>/rpgyw link</strong> for their own account. The Foundry world name does not have to match the campaign name.</p>

      {loading ? (
        <p className="campaign-control-status" role="status"><LoaderCircle className="play-entry-spin" aria-hidden="true" />Loading Foundry connections…</p>
      ) : connections.length ? (
        <div className="campaign-member-list">
          {connections.map((connection) => (
            <div key={connection.id} className="campaign-member-row">
              <span>
                <strong>{connection.world_label}</strong>
                <small>{connection.campaign_name} · controller {connection.controller_name} · last seen {new Date(connection.last_seen_at).toLocaleString()}</small>
              </span>
              <span className="campaign-control-badge">Connected</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="multiplayer-empty-state">
          <Cable aria-hidden="true" />
          <p>No Foundry world is connected yet. Your normal RPG Your Way campaigns continue to work without a VTT.</p>
        </div>
      )}

      {error ? <p className="auth-message auth-message-error" role="alert">{error}</p> : null}
    </section>
  )
}
