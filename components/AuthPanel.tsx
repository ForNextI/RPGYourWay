'use client'

import { signIn, signUp } from '@/app/account/actions'

type AuthPanelProps = {
  returnTo?: string
  status?: string
  error?: string
  compact?: boolean
}

const statusMessages: Record<string, string> = {
  'signed-in': 'Signed in. Your RPG Your Way account is connected.',
  created: 'Account created and signed in.',
  'check-email': 'If you’re new to RPG Your Way, check your email to confirm your account. If you already have an account, use Sign in.',
  confirmed: 'Email confirmed. Your account is ready.',
}

export function AuthPanel({ returnTo = '/account', status = '', error = '', compact = false }: AuthPanelProps) {
  const statusText = statusMessages[status]
  const errorText = error === 'confirmation'
    ? 'That confirmation link could not be verified. Please try signing in again.'
    : error

  return (
    <div className={compact ? 'auth-panel auth-panel-compact' : 'auth-panel'}>
      {statusText ? <p className="auth-message auth-message-success" role="status">{statusText}</p> : null}
      {errorText ? <p className="auth-message auth-message-error" role="alert">{errorText}</p> : null}

      <div className="auth-grid">
        <section className="auth-card" aria-labelledby={compact ? 'modal-sign-in-heading' : 'sign-in-heading'}>
          <p className="account-state-label">Already have an account?</p>
          <h2 id={compact ? 'modal-sign-in-heading' : 'sign-in-heading'}>Sign in</h2>
          <form action={signIn} className="auth-form">
            <input type="hidden" name="returnTo" value={returnTo} />
            <label>
              <span>Email</span>
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              <span>Password</span>
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            <button className="button button-primary auth-submit" type="submit">Sign in</button>
          </form>
        </section>

        <section className="auth-card" aria-labelledby={compact ? 'modal-sign-up-heading' : 'sign-up-heading'}>
          <p className="account-state-label">New to RPG Your Way?</p>
          <h2 id={compact ? 'modal-sign-up-heading' : 'sign-up-heading'}>Create an account</h2>
          <form action={signUp} className="auth-form">
            <input type="hidden" name="returnTo" value={returnTo} />
            <label>
              <span>Email</span>
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              <span>Password</span>
              <input name="password" type="password" autoComplete="new-password" minLength={8} required />
            </label>
            <p className="auth-hint">Use at least 8 characters. We’ll ask you to confirm your email address.</p>
            <button className="button button-secondary auth-submit" type="submit">Create account</button>
          </form>
        </section>
      </div>
    </div>
  )
}
