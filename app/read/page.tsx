import { PageShell } from '@/components/PageShell'

export const metadata = { title: 'Read' }

export default function ReadPage() {
  return (
    <PageShell>
      <main id="main-content" tabIndex={-1} className="inner-main">
        <div className="shell narrow-shell prose-page">
          <p className="kicker">Read</p>
          <h1 className="page-title">The novel.</h1>
          <p className="page-lede">If you&apos;re looking for the novel, it&apos;s over here at the free site.</p>
          <a className="button button-primary" href="https://www.thereadingofthewardens.com" target="_blank" rel="noreferrer">
            TheReadingOfTheWardens.com <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </main>
    </PageShell>
  )
}
