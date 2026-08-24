import type { ReactNode } from 'react'
import { AuthPrompt } from '@/components/AuthPrompt'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'

type PageShellProps = {
  children: ReactNode
  variant?: 'site' | 'play'
}

export function PageShell({ children, variant = 'site' }: PageShellProps) {
  return (
    <div className={`site-frame${variant === 'play' ? ' site-frame-play' : ''}`}>
      <SiteHeader />
      {children}
      <SiteFooter />
      <AuthPrompt />
    </div>
  )
}
