'use client'

import { type ChangeEvent, useRef, useState } from 'react'
import { FileUp, Shield } from 'lucide-react'
import {
  canonicalAdventureName,
  parseAdventureState,
  type SavedAdventureState,
} from '@/lib/aigm/campaign-storage'
import { saveAdventureState } from '@/lib/aigm/campaign-persistence'

export function CampaignHub() {
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const importRef = useRef<HTMLInputElement | null>(null)

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
    <details className="start-existing-details start-import-hub">
      <summary>
        <span>Import older adventures</span>
        <span className="accordion-plus" aria-hidden="true" />
      </summary>
      <div className="start-existing-body">
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
        {notice ? <p className="auth-message auth-message-success" role="status">{notice}</p> : null}
        {error ? <p className="auth-message auth-message-error" role="alert">{error}</p> : null}
      </div>
    </details>
  )
}
