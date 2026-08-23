import { PageShell } from '@/components/PageShell'

export const metadata = { title: 'Shape' }

export default function ShapePage() {
  return (
    <PageShell>
      <main id="main-content" tabIndex={-1} className="inner-main">
        <div className="shell narrow-shell">
          <p className="kicker">Shape</p>
          <h1 className="page-title">Turn the game into the story.</h1>
          <p className="page-lede">Shape turns campaign material into readable prose. The full converter is coming back here next.</p>
          <p className="note-box">Shape will be priced separately per conversion. It will not draw from your Play usage balance.</p>
        </div>
      </main>
    </PageShell>
  )
}
