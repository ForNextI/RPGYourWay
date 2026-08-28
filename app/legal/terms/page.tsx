import { PageShell } from '@/components/PageShell'

export const metadata = { title: 'Terms' }

export default function TermsPage() {
  return (
    <PageShell>
      <main id="main-content" tabIndex={-1} className="inner-main">
        <div className="shell narrow-shell prose-page">
          <p className="kicker">Legal</p>
          <h1 className="page-title">Terms</h1>
          <p>RPG Your Way currently offers paid AI usage through prepaid Play Packs. The prices, usage amounts, and limits shown in the product apply to those purchases. These terms may be expanded as the service evolves, including additional detail about payment handling and refunds.</p>
        </div>
      </main>
    </PageShell>
  )
}
