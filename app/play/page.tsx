import { PageShell } from '@/components/PageShell'

export const metadata = { title: 'Play' }

export default function PlayPage() {
  return (
    <PageShell variant="play">
      <main id="main-content" tabIndex={-1} className="inner-main">
        <div className="shell narrow-shell">
          <p className="kicker">Play</p>
          <h1 className="page-title">The game comes here next.</h1>
          <p className="page-lede">This route is reserved for the full RPG Your Way gameplay experience. The next build will begin bringing over the proven WardensPC gameplay systems without dragging the rest of the old site along with them.</p>
          <div className="placeholder-panel">
            <span className="placeholder-number">01</span>
            <div><strong>Campaign dashboard</strong><p>Choose, continue, import, or start a campaign.</p></div>
          </div>
          <div className="placeholder-panel">
            <span className="placeholder-number">02</span>
            <div><strong>Account-backed play</strong><p>Campaigns and paid usage will belong to the signed-in player instead of a single browser.</p></div>
          </div>
          <div className="placeholder-panel">
            <span className="placeholder-number">03</span>
            <div><strong>Mobile-first interface</strong><p>Typing remains primary, with dictation and read-aloud available without crowding the screen.</p></div>
          </div>
        </div>
      </main>
    </PageShell>
  )
}
