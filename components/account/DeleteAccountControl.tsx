'use client'

import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { deleteAccount } from '@/app/account/actions'
import { useAccessibleDialog } from '@/components/accessibility/use-accessible-dialog'

export function DeleteAccountControl() {
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const dialogRef = useAccessibleDialog<HTMLElement>({ open, onClose: () => setOpen(false), initialFocusRef: headingRef })

  return (
    <section className="account-danger-zone" aria-labelledby="delete-account-heading">
      <h2 id="delete-account-heading">Delete my account</h2>
      <p>Permanent account deletion is available here without affecting campaign files stored only in this browser.</p>
      <button type="button" className="account-delete-link" onClick={() => setOpen(true)}>Delete my account</button>

      {open ? (
        <div className="start-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
          <section ref={dialogRef} tabIndex={-1} className="start-modal" role="dialog" aria-modal="true" aria-labelledby="delete-account-modal-heading">
            <div className="start-modal-heading">
              <h2 ref={headingRef} tabIndex={-1} id="delete-account-modal-heading">Delete my account</h2>
              <button type="button" className="start-modal-x" onClick={() => setOpen(false)} aria-label="Close delete account dialog"><X aria-hidden="true" /></button>
            </div>
            <form action={deleteAccount} className="start-modal-body account-delete-modal-copy">
              <p><strong>This permanently deletes your RPG Your Way account and the server-side RPG Your Way records tied to it.</strong></p>
              <p>Any remaining usage balance will be lost and cannot be restored.</p>
              <p>Campaigns stored only in this browser are separate and will not be erased by account deletion. Export anything you want to keep before deleting the account.</p>
              <label className="account-delete-confirm">
                <span id="delete-account-confirm-help">Type <strong>DELETE</strong> to confirm.</span>
                <input name="confirmDelete" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" aria-describedby="delete-account-confirm-help" aria-invalid={Boolean(confirmation && confirmation !== 'DELETE')} />
              </label>
              <button className="account-delete-submit" type="submit" disabled={confirmation !== 'DELETE'}>Permanently delete my account</button>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  )
}
