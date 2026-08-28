import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'RPG Your Way',
    template: '%s | RPG Your Way',
  },
  description: 'Tabletop roleplaying on your schedule, with an AI Game Master built for ongoing campaigns.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.rpgyourway.com'),
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f2e2c8',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
