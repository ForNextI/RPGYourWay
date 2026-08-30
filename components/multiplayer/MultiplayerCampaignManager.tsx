'use client'

import { useEffect, useState } from 'react'
import { Check, Cloud, LoaderCircle, LogOut, Play, Trash2, UserMinus, X } from 'lucide-react'
import {
  CURRENT_ADVENTURE_KEY,
  type AdventureSummary,
} from '@/lib/aigm/campaign-storage'
import { deleteAdventureState, readAdventureIndexWithDatabase } from '@/lib/aigm/campaign-persistence'
import { forgetCloudRevision } from '@/lib/aigm/cloud-campaigns'
import {
  campaignGovernanceAction,
  loadCampaignGovernance,
  type CampaignDecision,
  type CampaignGovernanceView,
} from '@/lib/aigm/campaign-governance'

function administrationLabel(adventure: AdventureSummary) {
  if (adventure.campaign_mode !== 'multiplayer') return 'Solo'
  return adventure.campaign_administration === 'coordinator' ? 'Coordinator Control' : 'Shared Control'
}

function decisionTitle(decision: CampaignDecision) {
  return decision.type === 'delete_campaign'
    ? 'Delete this campaign'
    : `Remove ${decision.target_display_name || 'campaign member'}`
}

export function MultiplayerCampaignManager() {
  const [loading, setLoading] = useState(true)
  const [adventures, setAdventures] = useState<AdventureSummary[]>([])
  const [governance, setGovernance] = useState<Record<string, CampaignGovernanceView | undefined>>({})
  const [governanceLoading, setGovernanceLoading] = useState<Record<string, boolean>>({})
  const [busyCampaignId, setBusyCampaignId] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  async function refreshCampaigns() {
    setAdventures(await readAdventureIndexWithDatabase(window.localStorage))
  }

  useEffect(() => {
    let cancelled = false
    void readAdventureIndexWithDatabase(window.localStorage)
      .then((summaries) => {
        if (!cancelled) setAdventures(summaries)
      })
      .catch(() => {
        if (!cancelled) setError('RPG Your Way could not load your campaigns.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  function openAdventure(adventureId: string) {
    window.localStorage.setItem(CURRENT_ADVENTURE_KEY, adventureId)
    window.location.assign('/play')
  }

  async function clearLocalCampaign(adventureId: string) {
    forgetCloudRevision(window.localStorage, adventureId)
    await deleteAdventureState(window.localStorage, adventureId)
  }

  async function ensureGovernance(adventureId: string, force = false) {
    if (!force && governance[adventureId]) return governance[adventureId]
    setGovernanceLoading((current) => ({ ...current, [adventureId]: true }))
    try {
      const view = await loadCampaignGovernance(adventureId)
      setGovernance((current) => ({ ...current, [adventureId]: view }))
      return view
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'RPG Your Way could not load those campaign controls.')
      return null
    } finally {
      setGovernanceLoading((current) => ({ ...current, [adventureId]: false }))
    }
  }

  async function runAction(adventure: AdventureSummary, action: Record<string, unknown>, successMessage: string, removesSelf = false) {
    if (busyCampaignId) return
    setBusyCampaignId(adventure.adventure_id)
    setError('')
    setNotice('')
    try {
      const result = await campaignGovernanceAction(adventure.adventure_id, action)
      const actionResult = typeof result.action === 'string' ? result.action : ''
      const campaignGone = removesSelf || actionResult === 'deleted' || actionResult === 'proposal_executed' && action.action === 'vote' && governance[adventure.adventure_id]?.decisions.some((decision) => decision.id === action.proposal_id && decision.type === 'delete_campaign')
      if (campaignGone) {
        await clearLocalCampaign(adventure.adventure_id)
        setGovernance((current) => {
          const next = { ...current }
          delete next[adventure.adventure_id]
          return next
        })
        await refreshCampaigns()
      } else {
        const refreshed = await ensureGovernance(adventure.adventure_id, true)
        if (!refreshed) await refreshCampaigns()
      }
      setNotice(successMessage)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'RPG Your Way could not update that campaign.'
      if (/not available|no longer available|not found/i.test(message)) {
        await clearLocalCampaign(adventure.adventure_id)
        await refreshCampaigns().catch(() => undefined)
      }
      setError(message)
    } finally {
      setBusyCampaignId('')
    }
  }

  return (
    <section className="multiplayer-campaign-manager" aria-labelledby="multiplayer-campaigns-heading">
      <div className="multiplayer-section-heading">
        <p className="kicker">Native multiplayer</p>
        <h2 id="multiplayer-campaigns-heading">Campaign and multiplayer controls</h2>
        <p>Open any campaign below to continue it or manage the controls available to your account. Multiplayer campaigns also expose membership, group-decision, and coordinator controls here.</p>
      </div>

      {loading ? (
        <div className="play-entry-loading" role="status">
          <LoaderCircle className="play-entry-icon play-entry-spin" aria-hidden="true" />
          <p>Loading your campaigns…</p>
        </div>
      ) : adventures.length ? (
        <div className="play-entry-adventures multiplayer-campaign-list">
          {adventures.map((adventure) => {
            const view = governance[adventure.adventure_id]
            const controlsLoading = governanceLoading[adventure.adventure_id]
            const busy = busyCampaignId === adventure.adventure_id
            const cloudCampaign = adventure.storage_source === 'cloud'
            return (
              <details
                key={adventure.adventure_id}
                className="campaign-hub-card"
                onToggle={(event) => {
                  if (event.currentTarget.open && cloudCampaign) void ensureGovernance(adventure.adventure_id)
                }}
              >
                <summary className="campaign-hub-summary">
                  <span className="campaign-hub-summary-copy">
                    <strong>{adventure.adventure_name}</strong>
                    <small>{adventure.party_names.length ? adventure.party_names.join(', ') : 'Saved party'} · {cloudCampaign ? administrationLabel(adventure) : 'This browser · moves to cloud when opened'} · Updated {new Date(adventure.updated_at).toLocaleDateString()}</small>
                  </span>
                  <span className="accordion-plus" aria-hidden="true" />
                </summary>

                <div className="campaign-control-body">
                  <div className="campaign-hub-primary-action">
                    <button type="button" className="button button-primary" disabled={busy} onClick={() => openAdventure(adventure.adventure_id)}>
                      <Play aria-hidden="true" /> Continue Adventure
                    </button>
                  </div>

                  {!cloudCampaign ? (
                    <p className="campaign-control-note">This older browser campaign will move to your cloud account when you continue it.</p>
                  ) : null}

                  {cloudCampaign && controlsLoading && !view ? <p className="campaign-control-status"><LoaderCircle className="play-entry-spin" aria-hidden="true" />Loading campaign controls…</p> : null}
                  {cloudCampaign && view ? (
                    <>
                      <div className="campaign-control-heading">
                        <div><strong>{view.administration_mode === 'shared' ? 'Shared Control' : view.administration_mode === 'coordinator' ? 'Coordinator Control' : 'Solo campaign'}</strong><span>{view.members.length} {view.members.length === 1 ? 'member' : 'members'}</span></div>
                        {view.is_coordinator ? <span className="campaign-control-badge">You are coordinator</span> : null}
                      </div>

                      {view.decisions.length ? (
                        <section className="campaign-decisions" aria-label="Pending campaign decisions">
                          <h3>Pending decisions</h3>
                          {view.decisions.map((decision) => (
                            <article key={decision.id} className="campaign-decision-card">
                              <div><strong>{decisionTitle(decision)}</strong><span>Proposed by {decision.proposed_by_display_name}</span></div>
                              <p>{decision.approvals} of {decision.required} approvals{decision.oppositions ? ` · ${decision.oppositions} not approved` : ''}</p>
                              {decision.can_vote ? <div className="campaign-decision-actions"><button type="button" className={decision.my_vote === 'approve' ? 'is-selected' : ''} aria-pressed={decision.my_vote === 'approve'} disabled={busy} onClick={() => void runAction(adventure, { action: 'vote', proposal_id: decision.id, vote: 'approve' }, 'Your approval was recorded.')}><Check aria-hidden="true" />Approve</button><button type="button" className={decision.my_vote === 'oppose' ? 'is-selected' : ''} aria-pressed={decision.my_vote === 'oppose'} disabled={busy} onClick={() => void runAction(adventure, { action: 'vote', proposal_id: decision.id, vote: 'oppose' }, 'Your decision was recorded.')}><X aria-hidden="true" />Do not approve</button></div> : <p className="campaign-control-note">You are not a voter on this decision.</p>}
                            </article>
                          ))}
                        </section>
                      ) : null}

                      {view.campaign_mode === 'multiplayer' ? (
                        <section className="campaign-members" aria-label="Campaign members">
                          <h3>Members</h3>
                          <div className="campaign-member-list">
                            {view.members.map((member) => (
                              <div key={member.user_id} className="campaign-member-row">
                                <span><strong>{member.display_name}{member.is_self ? ' (you)' : ''}</strong>{member.is_coordinator ? ' · Coordinator' : ''}</span>
                                {!member.is_self && view.administration_mode === 'shared' ? <button type="button" disabled={busy || view.decisions.some((decision) => decision.type === 'remove_member' && decision.target_user_id === member.user_id)} onClick={() => { if (window.confirm(`Start a group vote to remove ${member.display_name} from this campaign?`)) void runAction(adventure, { action: 'propose_remove', target_user_id: member.user_id }, `A removal vote for ${member.display_name} is open.`) }}><UserMinus aria-hidden="true" />Propose removal</button> : null}
                                {!member.is_self && view.is_coordinator ? <div className="campaign-member-admin-actions"><button type="button" disabled={busy} onClick={() => { if (window.confirm(`Remove ${member.display_name} from this campaign?`)) void runAction(adventure, { action: 'remove_member', target_user_id: member.user_id }, `${member.display_name} was removed.`) }}><UserMinus aria-hidden="true" />Remove</button><button type="button" disabled={busy} onClick={() => { if (window.confirm(`Transfer coordinator control to ${member.display_name}?`)) void runAction(adventure, { action: 'transfer_coordinator', target_user_id: member.user_id }, `Coordinator control was transferred to ${member.display_name}.`) }}>Make coordinator</button></div> : null}
                              </div>
                            ))}
                          </div>
                        </section>
                      ) : null}

                      <details className="campaign-danger-details">
                        <summary><span>{view.campaign_mode === 'multiplayer' ? 'Leave or delete this campaign…' : 'Delete this campaign…'}</span><span className="accordion-plus campaign-danger-screw" aria-hidden="true" /></summary>
                        <div className="campaign-danger-body">
                          {view.can_leave ? <div><p>Leaving removes this campaign from your account. It does not delete the campaign for the other members.</p><button type="button" className="campaign-danger-button" disabled={busy} onClick={() => { if (window.confirm(`Leave "${adventure.adventure_name}"? You can only return if the campaign invites you again.`)) void runAction(adventure, { action: 'leave' }, `You left ${adventure.adventure_name}.`, true) }}><LogOut aria-hidden="true" />Confirm leave</button></div> : null}
                          {view.administration_mode === 'shared' ? <div><p>Shared campaigns can only be deleted when every current member approves. Deletion then enters a recovery window instead of being destroyed immediately.</p><button type="button" className="campaign-danger-button" disabled={busy || view.decisions.some((decision) => decision.type === 'delete_campaign')} onClick={() => { if (window.confirm(`Start a group vote to delete "${adventure.adventure_name}"?`)) void runAction(adventure, { action: 'propose_delete' }, `A deletion vote for ${adventure.adventure_name} is open.`) }}><Trash2 aria-hidden="true" />Propose deletion</button></div> : null}
                          {view.can_delete_directly ? <div><p>{view.campaign_mode === 'multiplayer' ? 'Coordinator deletion removes the campaign from everyone, but the server keeps a seven-day recovery window.' : 'Delete this campaign from your account. The server keeps a seven-day recovery window.'}</p><button type="button" className="campaign-danger-button" disabled={busy} onClick={() => { if (window.confirm(`Delete "${adventure.adventure_name}"? It will disappear now and enter a seven-day recovery window.`)) void runAction(adventure, { action: 'delete' }, `${adventure.adventure_name} was deleted.`, true) }}><Trash2 aria-hidden="true" />Confirm deletion</button></div> : null}
                          {view.administration_mode === 'coordinator' && view.is_coordinator && view.members.length > 1 ? <p className="campaign-control-note">To leave instead of deleting, transfer coordinator control to another member first.</p> : null}
                        </div>
                      </details>
                    </>
                  ) : null}
                </div>
              </details>
            )
          })}
        </div>
      ) : (
        <div className="multiplayer-empty-state">
          <Cloud aria-hidden="true" />
          <p>No campaigns yet. Create one in Start, choosing Multiplayer during the normal campaign setup when you want a shared campaign.</p>
        </div>
      )}

      {notice ? <p className="auth-message auth-message-success" role="status">{notice}</p> : null}
      {error ? <p className="auth-message auth-message-error" role="alert">{error}</p> : null}
    </section>
  )
}
