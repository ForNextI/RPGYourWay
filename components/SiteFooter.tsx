import Link from 'next/link'
import { APP_VERSION } from '@/lib/version'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <div className="footer-topline">
          <div className="footer-owner">
            <p>© 2026 dodo ink. Independent creative projects.</p>
            <p className="footer-build">RPG Your Way · Build {APP_VERSION}</p>
          </div>
          <nav aria-label="Footer navigation" className="footer-links">
            <Link href="/account">Account</Link>
            <Link href="/support">Support</Link>
            <Link href="/legal/privacy">Privacy</Link>
            <Link href="/legal/terms">Terms</Link>
          </nav>
        </div>

        <p className="footer-srd-attribution">
          This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at{' '}
          <a href="https://www.dndbeyond.com/srd">https://www.dndbeyond.com/srd</a>. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/legalcode">https://creativecommons.org/licenses/by/4.0/legalcode</a>.
        </p>
      </div>
    </footer>
  )
}
