'use client'

import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import { Check, Cloud, FileUp, LoaderCircle, LogOut, Play, Shield, Trash2, UserMinus, UsersRound, X } from 'lucide-react'
import {
  CURRENT_ADVENTURE_KEY,
  canonicalAdventureName,
  parseAdventureState,
  type AdventureSummary,
  type SavedAdventureState,
} from '@/lib/aigm/campaign-storage'
import { deleteAdventureState, readAdventureIndexWithDatabase, saveAdventureState } from '@/lib/aigm/campaign-persistence'
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

export function CampaignHub() {
  const [loading, setLoading] = useState(true)
  const [adventures, setAdventures] = useState<AdventureSummary[]>([])
  const [governance, setGovernance] = useState<Record<string, CampaignGovernanceView | undefined>>({})
  const [governanceLoading, setGovernanceLoading] = useState<Record<string, boolean>>({})
  const [busyCampaignId, setBusyCampaignId] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const importRef = useRef<HTMLInputElement | null>(null)

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

  async function importAdventure(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    setNotice('')
    try {
      const imported = parseAdventureState(await file.text())
      if (!imported) {
        setError('That file is not a compatible RPG Your Way or WardensPC exported game file.')
        return
      }
      if (imported.stage !== 'complete') {
        setError('That exported file predates a playable campaign state. RPG Your Way can import WardensPC exports that had already reached Play; use Start to create a new campaign from character information instead.')
        return
      }

      const now = new Date().toISOString()
      const importedState: SavedAdventureState = {
        ...imported,
        adventure_id: crypto.randomUUID(),
        adventure_name: canonicalAdventureName(imported.adventure_name),
        content_mode: imported.content_mode,
        imported_content_mode: imported.content_mode,
        content_mode_import_mismatch: false,
        content_mode_explanation_given: Boolean(imported.content_mode_explanation_given),
        created_at: now,
        updated_at: now,
      }
      await saveAdventureState(window.localStorage, importedState, null)
      setNotice(`Imported ${importedState.adventure_name}. Opening Play…`)
      window.location.assign('/play')
    } catch {
      setError('The exported game file could not be read.')
    }
  }

  return (
    <details className="start-existing-details start-campaign-hub">
      <summary>
        <span>Existing Campaigns, Controls &amp; Imports</span>
        <span className="accordion-plus" aria-hidden="true" />
      </summary>
      <div className="start-existing-body">
        <p className="start-existing-lede">Continue or manage a current campaign, handle multiplayer membership and group decisions, or import an older WardensPC or RPG Your Way adventure.</p>

        {loading ? (
          <div className="play-entry-loading" role="status">
            <LoaderCircle className="play-entry-icon play-entry-spin" aria-hidden="true" />
            <p>Loading your campaigns…</p>
          </div>
        ) : (
          <div className="play-entry-grid">
            <section className="play-entry-card" aria-labelledby="saved-adventures-heading">
              <div className="play-entry-card-title">
                <Cloud className="play-entry-icon" aria-hidden="true" />
                <div>
                  <p className="account-state-label">Your account</p>
                  <h2 id="saved-adventures-heading">Your Campaigns</h2>
                </div>
              </div>

              {adventures.length ? (
                <div className="play-entry-adventures">
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
              ) : <p className="play-entry-empty">No campaigns yet.</p>}
            </section>

            <section className="play-entry-card play-entry-import" aria-labelledby="import-adventure-heading">
              <div className="play-entry-card-title">
                <FileUp className="play-entry-icon" aria-hidden="true" />
                <div><p className="account-state-label">Import</p><h2 id="import-adventure-heading">Import an Older Adventure</h2></div>
              </div>
              <p>Use a full exported game JSON from WardensPC or an earlier RPG Your Way build. The imported copy gets a new cloud campaign ID, so the original file remains untouched.</p>
              <input ref={importRef} className="sr-only" type="file" tabIndex={-1} aria-hidden="true" accept="application/json,.json" onChange={importAdventure} />
              <button className="button button-primary" type="button" onClick={() => importRef.current?.click()}>Import Older Adventure</button>
              <div className="play-entry-device-note"><Shield aria-hidden="true" /><p><strong>Cloud migration.</strong> Once imported, the campaign is saved to your RPG Your Way account and can be opened from your other signed-in devices.</p></div>
            </section>
          </div>
        )}

        {notice ? <p className="auth-message auth-message-success" role="status">{notice}</p> : null}
        {error ? <p className="auth-message auth-message-error" role="alert">{error}</p> : null}
      </div>
    </details>
  )
}
