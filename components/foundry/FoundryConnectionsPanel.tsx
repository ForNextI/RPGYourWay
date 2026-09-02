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
