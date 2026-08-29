import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import Script from 'next/script'
import './globals.css'

const GOOGLE_ADS_TAG_ID = 'AW-18361311478'
const GOOGLE_TAG_MANAGER_ID = 'GTM-W5TL4QHK'

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
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GOOGLE_TAG_MANAGER_ID}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
            title="Google Tag Manager"
          />
        </noscript>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        {children}
        <Analytics />
        <Script id="google-tag-manager" strategy="beforeInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${GOOGLE_TAG_MANAGER_ID}');
          `}
        </Script>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_TAG_ID}`}
          strategy="beforeInteractive"
        />
        <Script id="google-ads-tag" strategy="beforeInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GOOGLE_ADS_TAG_ID}');
          `}
        </Script>
      </body>
    </html>
  )
}
