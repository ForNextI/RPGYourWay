import Link from 'next/link'
import { APP_VERSION } from '@/lib/version'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <div>
          <p className="footer-brand">RPG Your Way</p>
          <p className="footer-note">Built for campaigns that fit your schedule. <span className="footer-version">v{APP_VERSION}</span></p>
        </div>
        <nav aria-label="Footer navigation" className="footer-links">
          <Link href="/account">Account</Link>
          <Link href="/support">Support</Link>
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/terms">Terms</Link>
        </nav>
      </div>
    </footer>
  )
}
