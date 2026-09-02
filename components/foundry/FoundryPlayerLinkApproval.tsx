'use client'

import { useState } from 'react'
import { CheckCircle2, LoaderCircle } from 'lucide-react'

type PlayerLinkResult = {
  linked: boolean
  linkId: string
  campaignId: string
  campaignName: string
  campaignMode: string
  worldLabel: string
  foundryUserName: string
}

export function FoundryPlayerLinkApproval({ initialCode = '' }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<PlayerLinkResult | null>(null)

  async function approve() {
    if (approving || !code.trim()) return
    setApproving(true)
    setError('')

    try {
      const response = await fetch('/api/integrations/foundry/player-link/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(
          typeof body.error === 'string'
            ? body.error
            : 'RPG Your Way could not approve that Foundry player link.',
        )
      }
      setResult(body as PlayerLinkResult)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'RPG Your Way could not approve that Foundry player link.',
      )
    } finally {
      setApproving(false)
    }
  }

  if (result) {
    return (
      <section className="multiplayer-signin-card" aria-labelledby="foundry-player-linked-heading">
        <CheckCircle2 aria-hidden="true" />
        <h2 id="foundry-player-linked-heading">Foundry player linked.</h2>
        <p><strong>{result.foundryUserName}</strong> is linked to your RPG Your Way account for <strong>{result.campaignName}</strong>.</p>
        <p>Return to Foundry. The Integrator should finish the player link automatically within a few seconds. This approval page is finished; you do not need to visit Campaigns.</p>
      </section>
    )
  }

  return (
    <section className="multiplayer-signin-card" aria-labelledby="foundry-player-link-heading">
      <p className="kicker">Foundry VTT</p>
      <h2 id="foundry-player-link-heading">Link this Foundry player</h2>
      <p>This links the Foundry user you are currently playing through to your RPG Your Way account. It does not change Foundry character ownership, GM permissions, or who controls another character tonight.</p>

      <label>
        <span>Player-link code</span>
        <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="ABCD-EFGH" autoComplete="off" />
      </label>

      <button type="button" className="button button-primary" disabled={approving || !code.trim()} onClick={() => void approve()}>
        {approving ? <LoaderCircle className="play-entry-spin" aria-hidden="true" /> : null}
        Approve player link
      </button>

      {error ? <p className="auth-message auth-message-error" role="alert">{error}</p> : null}
    </section>
  )
}
