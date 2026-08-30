'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FullscreenToggle } from '@/components/accessibility/fullscreen-toggle'

const links = [
  { href: '/start', label: 'Start' },
  { href: '/play', label: 'Play' },
  { href: '/multiplayer', label: 'Multiplayer' },
  { href: '/script', label: 'Script' },
  { href: 'https://www.thereadingofthewardens.com', label: 'Read', external: true },
  { href: '/account', label: 'Account' },
]

function JeweledDivider() {
  return <span className="nav-jeweled-divider" aria-hidden="true" />
}

type SiteHeaderProps = {
  variant?: 'default' | 'landing'
}

export function SiteHeader({ variant = 'default' }: SiteHeaderProps) {
  const pathname = usePathname()
  const landingHeader = variant === 'landing'

  return (
    <header className={`site-header${landingHeader ? ' site-header--landing' : ''}`}>
      <div className="shell header-inner">
        <div className="site-brand-ribbon">
          <Link className="brand" href="/" aria-label="RPG Your Way home" aria-current={pathname === '/' ? 'page' : undefined}>
            <span className="brand-mark" aria-hidden="true">
              <Image src="/rpgyw-compass.png" alt="" width={32} height={32} priority />
            </span>
            <span className="brand-words">RPG Your Way</span>
          </Link>
          {landingHeader ? (
            <>
              <span className="brand-jewel-divider" aria-hidden="true" />
              <span className="brand-words brand-words-secondary">Your AI GM</span>
            </>
          ) : null}
        </div>
        <nav aria-label="Primary navigation" className="main-nav">
          {links.map((link, index) => (
            <span className="nav-item-group" key={link.href}>
              {index > 0 ? <JeweledDivider /> : null}
              {link.external ? (
                <a href={link.href} target="_blank" rel="noreferrer" aria-label={`${link.label} (opens in a new tab)`}>
                  <span>{link.label}</span>
                  <span className="nav-external-arrow" aria-hidden="true">↗</span>
                </a>
              ) : (
                <Link href={link.href} aria-current={pathname === link.href || (link.href !== '/' && pathname.startsWith(`${link.href}/`)) ? 'page' : undefined}>{link.label}</Link>
              )}
            </span>
          ))}
          <span className="fullscreen-nav-gap"><FullscreenToggle className="fullscreen-toggle" /></span>
        </nav>
      </div>
    </header>
  )
}
