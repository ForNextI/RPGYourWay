import { PageShell } from '@/components/PageShell'

export const metadata = { title: 'Privacy' }

export default function PrivacyPage() {
  return (
    <PageShell>
      <main id="main-content" tabIndex={-1} className="inner-main">
        <div className="shell narrow-shell prose-page">
          <p className="kicker">Legal</p>
          <h1 className="page-title">Privacy</h1>
          <p>This is a build placeholder, not the final privacy policy. The final policy will be written after the account, analytics, payment, and campaign-storage systems are chosen and wired.</p>
        </div>
      </main>
    </PageShell>
  )
}
