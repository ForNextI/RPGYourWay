import Link from 'next/link'

const links = [
  { href: '/play', label: 'Play' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/account', label: 'Account' },
]

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label="RPG Your Way home">
          <span className="brand-mark" aria-hidden="true">R</span>
          <span className="brand-words">RPG Your Way</span>
        </Link>
        <nav aria-label="Primary navigation" className="main-nav">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>{link.label}</Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
