import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <div>
          <p className="footer-brand">RPG Your Way</p>
          <p className="footer-note">Built for campaigns that fit your schedule.</p>
        </div>
        <nav aria-label="Footer navigation" className="footer-links">
          <Link href="/support">Support</Link>
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/terms">Terms</Link>
        </nav>
      </div>
    </footer>
  )
}
