'use client'

import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import { FileUp, LoaderCircle, Play, Shield, Smartphone } from 'lucide-react'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { AuthPrompt } from '@/components/AuthPrompt'
import { StartOnboarding } from '@/components/start/StartOnboarding'
import {
  CURRENT_ADVENTURE_KEY,
  canonicalAdventureName,
  parseAdventureState,
  type AdventureSummary,
  type SavedAdventureState,
} from '@/lib/aigm/campaign-storage'
import { readAdventureIndexWithDatabase, saveAdventureState } from '@/lib/aigm/campaign-persistence'

export function RpgywStartEntry() {
  const [loading, setLoading] = useState(true)
  const [adventures, setAdventures] = useState<AdventureSummary[]>([])
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const importRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let cancelled = false
    async function restore() {
      const summaries = await readAdventureIndexWithDatabase(window.localStorage)
      if (cancelled) return
      setAdventures(summaries)
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

  function openAdventure(adventureId: string) {
    window.localStorage.setItem(CURRENT_ADVENTURE_KEY, adventureId)
    // A full navigation gives Play a clean boot with one job only: gameplay.
    window.location.assign('/play')
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
        setError('That exported file has not reached Play yet. Finish its setup in WardensPC before importing it here, or wait for the rebuilt RPG Your Way onboarding flow.')
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
      setNotice(`Imported ${importedState.adventure_name}. Opening Play…`)

      // Do not transform the Start component into the gameplay component in-place.
      // Start owns import/selection; Play boots separately and owns gameplay.
      window.location.assign('/play')
    } catch {
      setError('The exported game file could not be read.')
    }
  }

  return (
    <div className="site-frame site-frame-play site-frame-start">
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="inner-main play-entry-main start-page-main">
        <div className="shell start-page-shell">
          <h1 className="sr-only">Start a new campaign or return to a saved adventure</h1>
          <StartOnboarding />

          <details className="start-existing-details">
            <summary>Already have an RPG Your Way or WardensPC adventure?</summary>
            <div className="start-existing-body">
              <p className="start-existing-lede">Continue a campaign already stored in this browser, or import a full exported game JSON. This returning-player path stays separate from new-campaign onboarding.</p>
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
                          <button key={adventure.adventure_id} type="button" className="play-entry-adventure" onClick={() => openAdventure(adventure.adventure_id)}>
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
                    <input ref={importRef} className="sr-only" type="file" tabIndex={-1} aria-hidden="true" accept="application/json,.json" onChange={importAdventure} />
                    <button className="button button-primary" type="button" onClick={() => importRef.current?.click()}>Import Existing Adventure</button>
                    <div className="play-entry-device-note">
                      <Smartphone aria-hidden="true" />
                      <p><strong>Changing devices?</strong> Export on the old device and import here on the new one. There is no cloud campaign synchronization in this release.</p>
                    </div>
                  </section>
                </div>
              )}

              {notice ? <p className="auth-message auth-message-success" role="status">{notice}</p> : null}
              {error ? <p className="auth-message auth-message-error" role="alert">{error}</p> : null}
            </div>
          </details>
        </div>
      </main>
      <SiteFooter />
      <AuthPrompt />
    </div>
  )
}