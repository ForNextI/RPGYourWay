import type { ReactNode } from 'react'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'

type PageShellProps = {
  children: ReactNode
  variant?: 'site' | 'play'
  headerVariant?: 'default' | 'landing'
}

export function PageShell({ children, variant = 'site', headerVariant = 'default' }: PageShellProps) {
  return (
    <div className={`site-frame${variant === 'play' ? ' site-frame-play' : ''}`}>
      <SiteHeader variant={headerVariant} />
      {children}
      <SiteFooter />
    </div>
  )
}
