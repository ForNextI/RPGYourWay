import { PageShell } from '@/components/PageShell'

export const metadata = { title: 'Support' }

export default function SupportPage() {
  return (
    <PageShell>
      <main id="main-content" tabIndex={-1} className="inner-main">
        <div className="shell narrow-shell prose-page">
          <p className="kicker">Support</p>
          <h1 className="page-title">Help without a scavenger hunt.</h1>
          <p>For help with RPG Your Way, email <a href="mailto:brett@rpgyourway.com">brett@rpgyourway.com</a>. Include the page you were using and what happened; do not send passwords or API keys.</p>
        </div>
      </main>
    </PageShell>
  )
}
