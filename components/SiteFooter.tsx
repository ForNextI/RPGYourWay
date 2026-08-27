import Link from 'next/link'
import { APP_VERSION } from '@/lib/version'

function KoFiCup() {
  return (
    <svg viewBox="0 0 24 24" className="kofi-cup" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zM18.992 12.937c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z"
      />
      <path
        fill="#FF5E5B"
        d="M12.819 12.459c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311z"
      />
    </svg>
  )
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <div className="footer-topline">
          <div className="footer-owner">
            <p>© 2026 dodo ink. Independent creative projects.</p>
            <p className="footer-build">RPG Your Way · Build {APP_VERSION}</p>
          </div>
          <div className="footer-actions">
            <a
              className="kofi-support-button"
              href="https://ko-fi.com/dodoink"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Buy Brett a Coffee on Ko-fi (opens in a new tab)"
            >
              <KoFiCup />
              <span>Buy Brett a Coffee</span>
            </a>
            <nav aria-label="Footer navigation" className="footer-links">
              <a href="mailto:brett@rpgyourway.com">Contact</a>
              <Link href="/account">Account</Link>
              <Link href="/legal/privacy">Privacy</Link>
              <Link href="/legal/terms">Terms</Link>
            </nav>
          </div>
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
