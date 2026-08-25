import Image from 'next/image'
import Link from 'next/link'
import { FullscreenToggle } from '@/components/FullscreenToggle'

const links = [
  { href: '/play', label: 'Play' },
  { href: '/script', label: 'Script' },
  { href: 'https://www.thereadingofthewardens.com', label: 'Read', external: true },
]

function JeweledDivider() {
  return <span className="nav-jeweled-divider" aria-hidden="true" />
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label="RPG Your Way home">
          <span className="brand-mark" aria-hidden="true">
            <Image src="/rpgyw-compass.png" alt="" width={36} height={36} priority />
          </span>
          <span className="brand-words">RPG Your Way</span>
        </Link>
        <nav aria-label="Primary navigation" className="main-nav">
          {links.map((link, index) => (
            <span className="nav-item-group" key={link.href}>
              {index > 0 ? <JeweledDivider /> : null}
              {link.external ? (
                <a href={link.href} target="_blank" rel="noreferrer">{link.label}</a>
              ) : (
                <Link href={link.href}>{link.label}</Link>
              )}
            </span>
          ))}
          <JeweledDivider />
          <FullscreenToggle />
        </nav>
      </div>
    </header>
  )
}
