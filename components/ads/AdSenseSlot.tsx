'use client'

import { useEffect, useRef } from 'react'

type AdPlacement = 'landing' | 'start' | 'script' | 'accessibility'

const DEFAULT_ADSENSE_CLIENT_ID = 'ca-pub-7652380497334820'
const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim() || DEFAULT_ADSENSE_CLIENT_ID
const ADSENSE_SLOTS: Record<AdPlacement, string> = {
  landing: process.env.NEXT_PUBLIC_ADSENSE_SLOT_LANDING?.trim() || '',
  start: process.env.NEXT_PUBLIC_ADSENSE_SLOT_START?.trim() || '',
  script: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SCRIPT?.trim() || '',
  accessibility: process.env.NEXT_PUBLIC_ADSENSE_SLOT_ACCESSIBILITY?.trim() || '',
}

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[]
  }
}

export function AdSenseSlot({ placement }: { placement: AdPlacement }) {
  const slotId = ADSENSE_SLOTS[placement]
  const requestQueued = useRef(false)

  useEffect(() => {
    if (!slotId || !ADSENSE_CLIENT_ID || requestQueued.current) return

    requestQueued.current = true
    window.adsbygoogle = window.adsbygoogle || []
    window.adsbygoogle.push({})
  }, [slotId])

  return (
    <aside className={`ad-placement ad-placement--${placement}`} aria-label="Advertisements">
      <p className="ad-placement-label">Advertisements</p>
      <div className={`ad-placement-frame ${slotId ? 'ad-placement-frame--configured' : 'ad-placement-frame--placeholder'}`}>
        {slotId ? (
          <ins
            className="adsbygoogle rpgyw-responsive-ad"
            data-ad-client={ADSENSE_CLIENT_ID}
            data-ad-slot={slotId}
          />
        ) : null}
      </div>
    </aside>
  )
}
