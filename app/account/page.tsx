import { PageShell } from '@/components/PageShell'

export const metadata = { title: 'Account' }

export default function AccountPage() {
  return (
    <PageShell>
      <main id="main-content" tabIndex={-1} className="inner-main">
        <div className="shell narrow-shell">
          <p className="kicker">Account</p>
          <h1 className="page-title">One account. Your campaigns.</h1>
          <p className="page-lede">Authentication is the next infrastructure layer. This page is intentionally a placeholder until we wire the real account provider rather than building a fake login screen.</p>
          <div className="account-placeholder">
            <p className="account-placeholder-title">Account system not connected yet</p>
            <p>When it is, this page will hold sign-in, campaign access, usage balance, purchase history, and account settings.</p>
          </div>
        </div>
      </main>
    </PageShell>
  )
}
