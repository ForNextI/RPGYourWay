'use client'

import { useEffect, useRef, useState } from 'react'
import { AuthPanel } from '@/components/AuthPanel'
import { createClient } from '@/lib/supabase/client'

const DISMISS_KEY = 'rpgyw-auth-prompt-dismissed-date'

function localDateKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function currentReturnPath() {
  return window.location.pathname || '/'
}

function clearAuthQuery() {
  const url = new URL(window.location.href)
  url.searchParams.delete('authStatus')
  url.searchParams.delete('authError')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

export function AuthPrompt() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [returnTo, setReturnTo] = useState('/')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function checkPrompt() {
      const path = currentReturnPath()
      setReturnTo(path)

      if (path === '/account' || path.startsWith('/auth/')) return

      const params = new URLSearchParams(window.location.search)
      const authStatus = params.get('authStatus') ?? ''
      const authError = params.get('authError') ?? ''
      const forceOpen = Boolean(authStatus || authError)

      setStatus(authStatus)
      setError(authError)

      const supabase = createClient()
      const { data } = await supabase.auth.getSession()
      if (!active || data.session) return

      const dismissedToday = window.localStorage.getItem(DISMISS_KEY) === localDateKey()
      if (forceOpen || !dismissedToday) setOpen(true)
    }

    checkPrompt()
    return () => { active = false }
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, localDateKey())
    clearAuthQuery()
    setStatus('')
    setError('')
    setOpen(false)
  }

  return (
    <dialog
      ref={dialogRef}
      className="auth-dialog"
      aria-labelledby="auth-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        dismiss()
      }}
    >
      <div className="auth-dialog-inner">
        <div className="auth-dialog-heading">
          <div>
            <p className="kicker">Account</p>
            <h2 id="auth-dialog-title">Welcome to RPG Your Way</h2>
            <p>Sign in to reconnect with your account, or create one if this is your first visit.</p>
          </div>
          <button className="auth-dialog-close" type="button" onClick={dismiss} aria-label="Close account sign-in">
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <AuthPanel returnTo={returnTo} status={status} error={error} compact />

        <div className="auth-dialog-footer">
          <button className="auth-not-now" type="button" onClick={dismiss}>Not now</button>
        </div>
      </div>
    </dialog>
  )
}
