import Link from 'next/link'
import { PageShell } from '@/components/PageShell'

export default function NotFound() {
  return (
    <PageShell>
      <main id="main-content" tabIndex={-1} className="inner-main">
        <div className="shell narrow-shell prose-page">
          <p className="kicker">404</p>
          <h1 className="page-title">That path wandered off the map.</h1>
          <p className="page-lede">There is nothing here yet.</p>
          <Link className="button button-primary" href="/">Back home</Link>
        </div>
      </main>
    </PageShell>
  )
}
