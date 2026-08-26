'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { deleteAccount } from '@/app/account/actions'

export function DeleteAccountControl() {
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <section className="account-danger-zone" aria-labelledby="delete-account-heading">
      <h2 id="delete-account-heading">Delete my account</h2>
      <p>Permanent account deletion is available here without affecting campaign files stored only in this browser.</p>
      <button type="button" className="account-delete-link" onClick={() => setOpen(true)}>Delete my account</button>

      {open ? (
        <div className="start-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
          <section className="start-modal" role="dialog" aria-modal="true" aria-labelledby="delete-account-modal-heading">
            <div className="start-modal-heading">
              <h2 id="delete-account-modal-heading">Delete my account</h2>
              <button type="button" className="start-modal-x" onClick={() => setOpen(false)} aria-label="Close"><X aria-hidden="true" /></button>
            </div>
            <form action={deleteAccount} className="start-modal-body account-delete-modal-copy">
              <p><strong>This permanently deletes your RPG Your Way account and the server-side RPG Your Way records tied to it.</strong></p>
              <p>Any remaining usage balance will be lost and cannot be restored.</p>
              <p>Campaigns stored only in this browser are separate and will not be erased by account deletion. Export anything you want to keep before deleting the account.</p>
              <label className="account-delete-confirm">
                <span>Type <strong>DELETE</strong> to confirm.</span>
                <input name="confirmDelete" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
              </label>
              <button className="account-delete-submit" type="submit" disabled={confirmation !== 'DELETE'}>Permanently delete my account</button>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  )
}
