import { PageShell } from '@/components/PageShell'

export const metadata = { title: 'Support' }

export default function SupportPage() {
  return (
    <PageShell>
      <main id="main-content" tabIndex={-1} className="inner-main">
        <div className="shell narrow-shell prose-page">
          <p className="kicker">Support</p>
          <h1 className="page-title">Help without a scavenger hunt.</h1>
          <p>Support contact details and the paid-beta support process will be added before live payments are enabled.</p>
        </div>
      </main>
    </PageShell>
  )
}
