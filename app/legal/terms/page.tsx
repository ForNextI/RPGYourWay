import { PageShell } from '@/components/PageShell'

export const metadata = { title: 'Terms' }

export default function TermsPage() {
  return (
    <PageShell>
      <main id="main-content" tabIndex={-1} className="inner-main">
        <div className="shell narrow-shell prose-page">
          <p className="kicker">Legal</p>
          <h1 className="page-title">Terms</h1>
          <p>This is a build placeholder, not the final terms of service. The commercial terms, payment rules, refunds, and usage limits will be finalized before paid access is switched on.</p>
        </div>
      </main>
    </PageShell>
  )
}
