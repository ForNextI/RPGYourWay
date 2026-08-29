'use client'

import { useEffect } from 'react'

const GOOGLE_ADS_PURCHASE_DESTINATION = 'AW-18361311478/ub-xCO3YnOocEPbBrbNE'

type GoogleAdsPurchaseConversionProps = {
  transactionId: string
  value: number
}

type GtagWindow = Window & {
  gtag?: (...args: unknown[]) => void
}

export function GoogleAdsPurchaseConversion({ transactionId, value }: GoogleAdsPurchaseConversionProps) {
  useEffect(() => {
    const gtag = (window as GtagWindow).gtag
    if (typeof gtag !== 'function') return

    gtag('event', 'conversion', {
      send_to: GOOGLE_ADS_PURCHASE_DESTINATION,
      value,
      currency: 'USD',
      transaction_id: transactionId,
    })
  }, [transactionId, value])

  return null
}
