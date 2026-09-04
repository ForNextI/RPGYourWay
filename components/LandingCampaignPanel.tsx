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

const LANDING_PREVIEW = {
  name: 'Your campaign name',
  scene: 'Current location',
  turnsLabel: 'Turn 01',
  snippet: 'When you have an active campaign, the latest reply from your AI GM will appear here so you can see where you left off.',
} as const

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
  return clean
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
    }

    void restore().catch(() => {
      // Leave the inviting landing preview in place when the browser has no saved campaign.
    })
    return () => { cancelled = true }
  }, [])

  function returnToPlaying() {
    if (!campaign) return
    window.localStorage.setItem(CURRENT_ADVENTURE_KEY, campaign.id)
    window.location.assign('/play')
  }

  if (!campaign) {
    return (
      <div className="landing-campaign-panel landing-campaign-preview" aria-label="Campaign preview">
        <div className="landing-campaign-summary-card">
          <div className="landing-campaign-heading">
            <div>
              <p className="campaign-label">Current campaign</p>
              <h2>{LANDING_PREVIEW.name}</h2>
            </div>
            <p className="landing-campaign-turns">{LANDING_PREVIEW.turnsLabel}</p>
          </div>

          <p className="landing-campaign-scene">{LANDING_PREVIEW.scene}</p>
        </div>

        <div className="landing-campaign-screen-stage">
          <div className="landing-campaign-screen-olive-frame">
            <div className="landing-campaign-snippet landing-campaign-snippet--preview">
              <p>{LANDING_PREVIEW.snippet}</p>
            </div>
          </div>
        </div>

        <div className="landing-campaign-actions landing-campaign-actions--preview">
          <div className="landing-balance-control">
            <span>Remaining Balance</span>
            <strong>{balance || '—'}</strong>
          </div>
          <button
            type="button"
            className="button button-primary landing-return-button"
            onClick={() => window.location.assign('/start')}
          >
            Start Adventure
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="landing-campaign-panel">
      <div className="landing-campaign-summary-card">
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
      </div>

      <div className="landing-campaign-screen-stage">
        <div className="landing-campaign-screen-olive-frame">
          <blockquote className="landing-campaign-snippet">
            <span>{campaign.snippet || 'Your adventure is ready to continue.'}</span>
          </blockquote>
        </div>
      </div>

      <div className="landing-campaign-actions">
        <div className="landing-balance-control">
          <span>Remaining Balance</span>
          <strong>{balance || '—'}</strong>
        </div>
        <button type="button" className="button button-primary landing-return-button" onClick={returnToPlaying}>
          Continue Adventure
        </button>
      </div>
    </div>
  )
}
