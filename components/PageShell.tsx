import type { ReactNode } from 'react'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="site-frame">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  )
}
