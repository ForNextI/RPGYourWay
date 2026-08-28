import { PageShell } from '@/components/PageShell'

export const metadata = { title: 'Privacy' }

export default function PrivacyPage() {
  return (
    <PageShell>
      <main id="main-content" tabIndex={-1} className="inner-main">
        <div className="shell narrow-shell prose-page">
          <p className="kicker">Legal</p>
          <h1 className="page-title">Privacy</h1>
          <p>This is a build placeholder, not the final privacy policy. RPG Your Way accounts, payments, analytics, and campaign cloud storage are now being wired. Signed-in campaign state is stored with the account so a campaign can be continued from another signed-in device; browser storage may be used as a local cache. The final policy will describe retention, deletion, multiplayer membership, transcripts, and service providers in full before public launch.</p>
        </div>
      </main>
    </PageShell>
  )
}
