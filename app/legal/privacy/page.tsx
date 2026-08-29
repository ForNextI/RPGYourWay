import { PageShell } from '@/components/PageShell'

export const metadata = { title: 'Privacy' }

export default function PrivacyPage() {
  return (
    <PageShell>
      <main id="main-content" tabIndex={-1} className="inner-main">
        <div className="shell narrow-shell prose-page">
          <p className="kicker">Legal</p>
          <h1 className="page-title">Privacy</h1>
          <p>RPG Your Way uses accounts, payments, analytics, advertising measurement, and campaign cloud storage to operate the service. Signed-in campaign state is stored with the account so a campaign can continue from another signed-in device; browser storage may also be used as a local cache. Account deletion, multiplayer membership, transcripts, and service-provider data are handled as part of those features. This page will be expanded as the service and its data practices change.</p>
        </div>
      </main>
    </PageShell>
  )
}
