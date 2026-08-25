'use client'

import Link from 'next/link'
import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import { FileUp, LoaderCircle, Play, Shield, Smartphone } from 'lucide-react'
import { AigmGameplayShell } from '@/components/aigm/aigm-gameplay-shell'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { AuthPrompt } from '@/components/AuthPrompt'
import {
  CURRENT_ADVENTURE_KEY,
  canonicalAdventureName,
  parseAdventureState,
  type AdventureSummary,
  type SavedAdventureState,
} from '@/lib/aigm/campaign-storage'
import { readAdventureIndexWithDatabase, saveAdventureState } from '@/lib/aigm/campaign-persistence'

export function RpgywPlayEntry() {
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [adventures, setAdventures] = useState<AdventureSummary[]>([])
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const importRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let cancelled = false
    async function restore() {
      const currentId = window.localStorage.getItem(CURRENT_ADVENTURE_KEY)
      const summaries = await readAdventureIndexWithDatabase(window.localStorage)
      if (cancelled) return
      setAdventures(summaries)
      setPlaying(Boolean(currentId && summaries.some((entry) => entry.adventure_id === currentId)))
      setLoading(false)
    }
    void restore().catch(() => {
      if (!cancelled) {
        setError('RPG Your Way could not read the adventures stored in this browser.')
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  function continueAdventure(adventureId: string) {
    window.localStorage.setItem(CURRENT_ADVENTURE_KEY, adventureId)
    setPlaying(true)
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
        setError('That exported file has not reached Play yet. Finish its setup in WardensPC before importing it here, or use Start when RPG Your Way onboarding is ready.')
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
      setAdventures(await readAdventureIndexWithDatabase(window.localStorage))
      setNotice(`Imported ${importedState.adventure_name}. Opening it now.`)
      setPlaying(true)
    } catch {
      setError('The exported game file could not be read.')
    }
  }

  if (playing) return <AigmGameplayShell />

  return (
    <div className="site-frame site-frame-play">
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="inner-main play-entry-main">
        <div className="shell play-entry-shell">
          <div className="play-entry-heading">
            <p className="kicker">Play</p>
            <h1 className="page-title">Continue an adventure.</h1>
            <p className="page-lede">RPG Your Way 1.7 begins with existing adventures. Campaigns stay in this browser. Export a game when you want a backup or want to move it to another device.</p>
          </div>

          {loading ? (
            <div className="play-entry-loading" role="status">
              <LoaderCircle className="play-entry-icon play-entry-spin" aria-hidden="true" />
              <p>Checking this browser for saved adventures…</p>
            </div>
          ) : (
            <div className="play-entry-grid">
              <section className="play-entry-card" aria-labelledby="saved-adventures-heading">
                <div className="play-entry-card-title">
                  <Shield className="play-entry-icon" aria-hidden="true" />
                  <div>
                    <p className="account-state-label">This browser</p>
                    <h2 id="saved-adventures-heading">Saved adventures</h2>
                  </div>
                </div>
                {adventures.length ? (
                  <div className="play-entry-adventures">
                    {adventures.map((adventure) => (
                      <button key={adventure.adventure_id} type="button" className="play-entry-adventure" onClick={() => continueAdventure(adventure.adventure_id)}>
                        <span>
                          <strong>{adventure.adventure_name}</strong>
                          <small>{adventure.party_names.length ? adventure.party_names.join(', ') : 'Saved party'} · Updated {new Date(adventure.updated_at).toLocaleDateString()}</small>
                        </span>
                        <span className="play-entry-continue"><Play aria-hidden="true" /> Continue</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="play-entry-empty">No RPG Your Way adventures are stored in this browser yet.</p>
                )}
              </section>

              <section className="play-entry-card play-entry-import" aria-labelledby="import-adventure-heading">
                <div className="play-entry-card-title">
                  <FileUp className="play-entry-icon" aria-hidden="true" />
                  <div>
                    <p className="account-state-label">Bring your game</p>
                    <h2 id="import-adventure-heading">Import an existing adventure</h2>
                  </div>
                </div>
                <p>Use a full exported game JSON from WardensPC or RPG Your Way. The imported copy gets a new local campaign ID, so the original export remains untouched.</p>
                <input ref={importRef} className="sr-only" type="file" accept="application/json,.json" onChange={importAdventure} />
                <button className="button button-primary" type="button" onClick={() => importRef.current?.click()}>Import Existing Adventure</button>
                <div className="play-entry-device-note">
                  <Smartphone aria-hidden="true" />
                  <p><strong>Changing devices?</strong> Export on the old device and import on the new one. There is no cloud campaign synchronization in this release.</p>
                </div>
              </section>
            </div>
          )}

          {notice ? <p className="auth-message auth-message-success" role="status">{notice}</p> : null}
          {error ? <p className="auth-message auth-message-error" role="alert">{error}</p> : null}

          <div className="play-entry-start">
            <div>
              <p className="account-state-label">New adventure</p>
              <h2>Starting fresh?</h2>
              <p>The new Start experience is being rebuilt separately. Its permanent doorway is ready now.</p>
            </div>
            <Link className="button button-secondary" href="/start">Go to Start</Link>
          </div>
        </div>
      </main>
      <SiteFooter />
      <AuthPrompt />
    </div>
  )
}
