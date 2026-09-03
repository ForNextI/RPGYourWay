'use client'

import Link from 'next/link'
import { useId, useRef } from 'react'
import { useAccessibleDialog } from '@/components/accessibility/use-accessible-dialog'

export type UsageGatePurpose = 'adventure' | 'help' | 'character'
export type UsageGateReason = 'account' | 'usage'

const PURPOSE_COPY: Record<UsageGatePurpose, { title: string; body: string; extra?: string }> = {
  adventure: {
    title: 'Ready to begin your adventure?',
    body: 'Running the adventure uses RPG Your Way’s AI services.',
  },
  help: {
    title: 'Detailed Help is for account holders.',
    body: 'This level of interactive help uses RPG Your Way’s AI services.',
  },
  character: {
    title: 'Importing your own characters uses RPG Your Way’s AI.',
    body: 'RPG Your Way uses AI to read your character record and prepare it for play.',
    extra: 'Feel free to use our pre-made Ready-to-Play characters to explore the system, build a campaign, and see what the Play page looks like.',
  },
}

export function UsageGateDialog({
  open,
  purpose,
  reason,
  onClose,
}: {
  open: boolean
  purpose: UsageGatePurpose
  reason: UsageGateReason
  onClose: () => void
}) {
  const headingId = useId()
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const dialogRef = useAccessibleDialog<HTMLElement>({ open, onClose, initialFocusRef: headingRef })

  if (!open) return null

  const copy = PURPOSE_COPY[purpose]
  const accountNeeded = reason === 'account'
  const actionHref = accountNeeded ? '/account#sign-in' : '/account#add-usage'
  const actionLabel = accountNeeded
    ? 'Yeah, I’d like to create an account.'
    : 'Oh right, I need to add some usage.'

  return (
    <div
      className="usage-gate-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="usage-gate-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
      >
        <div className="usage-gate-nameplate">
          <h2 ref={headingRef} tabIndex={-1} id={headingId}>{copy.title}</h2>
        </div>
        <div className="usage-gate-copy">
          <p>{copy.body}</p>
          <p>
            {accountNeeded
              ? 'To continue, you’ll need an account and purchased usage.'
              : 'To continue, you’ll need to add some usage to your account.'}
          </p>
          {copy.extra ? <p className="usage-gate-preview-note"><strong>{copy.extra}</strong></p> : null}
        </div>
        <div className="usage-gate-actions">
          <Link className="button button-primary" href={actionHref}>{actionLabel}</Link>
          <button className="button button-secondary" type="button" onClick={onClose}>
            Not now, I want to continue looking around.
          </button>
        </div>
      </section>
    </div>
  )
}
