'use client'

import { useEffect, useState } from 'react'
import { CURRENT_ADVENTURE_KEY, type SavedAdventureState } from '@/lib/aigm/campaign-storage'
import { loadAdventureState, readAdventureIndexWithDatabase } from '@/lib/aigm/campaign-persistence'

type LandingCampaignView = {
  id: string
  name: string
  gameMaster: string
  scene: string
  turns: number
  snippet: string
}

function compactScene(value: string) {
  const clean = value.replace(/\s+/g, ' ').trim()
  if (!clean) return 'Adventure ready'
  const firstLocation = clean.split(/\s+[—–]\s+/)[0]?.trim() || clean
  return firstLocation.length > 90 ? `${firstLocation.slice(0, 87).trimEnd()}…` : firstLocation
}

function cleanSnippet(value: string) {
  const clean = value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_#>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!clean) return ''
  return clean.length > 420 ? `${clean.slice(0, 417).trimEnd()}…` : clean
}

function campaignView(state: SavedAdventureState): LandingCampaignView {
  const transcript = state.gameplay.transcript.length ? state.gameplay.transcript : state.gameplay.messages
  const latestAssistant = [...transcript].reverse().find((entry) => entry.role === 'assistant')?.text || state.gameplay.campaign_summary || ''
  return {
    id: state.adventure_id,
    name: state.adventure_name,
    gameMaster: state.game_master_name,
    scene: compactScene(state.gameplay.scene),
    turns: state.gameplay.turn_count,
    snippet: cleanSnippet(latestAssistant),
  }
}

export function LandingCampaignPanel() {
  const [campaign, setCampaign] = useState<LandingCampaignView | null>(null)
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState('')

  useEffect(() => {
    let cancelled = false

    async function restore() {
      const summaries = await readAdventureIndexWithDatabase(window.localStorage)
      const currentId = window.localStorage.getItem(CURRENT_ADVENTURE_KEY)
      const chosenId = currentId && summaries.some((entry) => entry.adventure_id === currentId)
        ? currentId
        : summaries[0]?.adventure_id

      if (chosenId) {
        const loaded = await loadAdventureState(window.localStorage, chosenId)
        if (!cancelled && loaded.state) setCampaign(campaignView(loaded.state))
      }

      try {
        const response = await fetch('/api/usage/balance', { cache: 'no-store' })
        const payload = await response.json() as { available_display?: string }
        if (!cancelled && response.ok && payload.available_display) setBalance(payload.available_display)
      } catch {
        // Balance is useful when available, but it must never block the return-to-play shortcut.
      }

      if (!cancelled) setLoading(false)
    }

    void restore().catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  function returnToPlaying() {
    if (!campaign) return
    window.localStorage.setItem(CURRENT_ADVENTURE_KEY, campaign.id)
    window.location.assign('/play')
  }

  if (loading) {
    return (
      <div className="landing-campaign-panel landing-campaign-loading" aria-live="polite">
        <p className="campaign-label">Current campaign</p>
        <p>Checking this browser for your adventure…</p>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="landing-campaign-panel landing-campaign-empty">
        <p className="campaign-label">Current campaign</p>
        <h2>No campaign in this browser yet</h2>
        <p>Bring an existing WardensPC export to Start, or use the New Player doorway when onboarding opens.</p>
      </div>
    )
  }

  return (
    <div className="landing-campaign-panel">
      <div className="landing-campaign-heading">
        <div>
          <p className="campaign-label">Current campaign</p>
          <h2>{campaign.name}</h2>
        </div>
        <p className="landing-campaign-turns">{campaign.turns.toLocaleString()} turn{campaign.turns === 1 ? '' : 's'}</p>
      </div>

      <p className="landing-campaign-scene">
        {[campaign.gameMaster, campaign.scene].filter(Boolean).join(' · ')}
      </p>

      <blockquote className="landing-campaign-snippet">
        {campaign.snippet || 'Your adventure is ready to continue.'}
      </blockquote>

      <div className="landing-campaign-actions">
        {balance ? <p className="landing-campaign-balance"><span>Balance</span><strong>{balance}</strong></p> : <span />}
        <button type="button" className="button button-primary landing-return-button" onClick={returnToPlaying}>
          Return to Adventure
        </button>
      </div>
    </div>
  )
}
