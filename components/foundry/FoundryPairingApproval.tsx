'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, LoaderCircle } from 'lucide-react'

type CampaignSummary = {
  adventure_id: string
  adventure_name: string
  campaign_mode: 'solo' | 'multiplayer'
  party_names?: string[]
}

type ApprovalResult = {
  connected: boolean
  campaignId: string
  campaignName: string
  campaignMode: string
  worldLabel: string
  foundryUserName: string
}

export function FoundryPairingApproval({ initialCode = '' }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode)
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [campaignId, setCampaignId] = useState('')
  const [loadingCampaigns, setLoadingCampaigns] = useState(true)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ApprovalResult | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch('/api/campaigns', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Could not load your campaigns.')
        return body
      })
      .then((body) => {
        if (cancelled) return
        const next = Array.isArray(body.campaigns) ? body.campaigns as CampaignSummary[] : []
        setCampaigns(next)
        if (next.length === 1) setCampaignId(next[0].adventure_id)
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not load your campaigns.')
      })
      .finally(() => {
        if (!cancelled) setLoadingCampaigns(false)
      })

    return () => { cancelled = true }
  }, [])

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.adventure_id === campaignId) ?? null,
    [campaignId, campaigns],
  )

  async function approve() {
    if (approving || !code.trim() || !campaignId) return
    setApproving(true)
    setError('')
    try {
      const response = await fetch('/api/integrations/foundry/pair/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), campaign_id: campaignId }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'RPG Your Way could not approve that Foundry connection.')
      setResult(body as ApprovalResult)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'RPG Your Way could not approve that Foundry connection.')
    } finally {
      setApproving(false)
    }
  }

  if (result) {
    return (
      <section className="multiplayer-signin-card" aria-labelledby="foundry-connected-heading">
        <CheckCircle2 aria-hidden="true" />
        <h2 id="foundry-connected-heading">Foundry is connected.</h2>
        <p><strong>{result.worldLabel}</strong> is now linked to <strong>{result.campaignName}</strong>.</p>
        <p>Return to Foundry. The Integrator should finish pairing automatically within a few seconds.</p>
        <Link className="button button-primary" href="/campaigns">Back to Campaigns</Link>
      </section>
    )
  }

  return (
    <section className="multiplayer-signin-card" aria-labelledby="foundry-connect-heading">
      <p className="kicker">Foundry VTT</p>
      <h2 id="foundry-connect-heading">Connect this Foundry world</h2>
      <p>Choose which RPG Your Way cloud campaign this Foundry world represents. This does not send your Foundry maps, token art, commercial compendia, or installed adventures to the AIGM.</p>

      <label>
        <span>Connection code</span>
        <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="ABCD-EFGH" autoComplete="off" />
      </label>

      {loadingCampaigns ? (
        <p className="campaign-control-status" role="status"><LoaderCircle className="play-entry-spin" aria-hidden="true" />Loading your campaigns…</p>
      ) : campaigns.length ? (
        <label>
          <span>RPG Your Way campaign</span>
          <select value={campaignId} onChange={(event) => setCampaignId(event.target.value)}>
            <option value="">Choose a campaign…</option>
            {campaigns.map((campaign) => (
              <option key={campaign.adventure_id} value={campaign.adventure_id}>
                {campaign.adventure_name} ({campaign.campaign_mode === 'multiplayer' ? 'Multiplayer' : 'Solo'})
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p>You do not have a cloud campaign to connect yet. Create or open one in RPG Your Way first.</p>
      )}

      {selectedCampaign ? <p className="campaign-control-note">Connecting: <strong>{selectedCampaign.adventure_name}</strong></p> : null}

      <button type="button" className="button button-primary" disabled={approving || !code.trim() || !campaignId} onClick={() => void approve()}>
        {approving ? <LoaderCircle className="play-entry-spin" aria-hidden="true" /> : null}
        Approve Foundry connection
      </button>

      {error ? <p className="auth-message auth-message-error" role="alert">{error}</p> : null}
    </section>
  )
}
