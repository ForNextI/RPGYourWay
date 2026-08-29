'use client'

import { useEffect } from 'react'

const GOOGLE_ADS_PURCHASE_DESTINATION = 'AW-18361311478/ub-xCO3YnOocEPbBrbNE'

type PurchaseTrackingProps = {
  transactionId: string
  value: number
  email: string | null
  itemId: string
  itemName: string
}

type TrackingWindow = Window & {
  dataLayer?: unknown[]
  gtag?: (...args: unknown[]) => void
}

export function PurchaseTracking({ transactionId, value, email, itemId, itemName }: PurchaseTrackingProps) {
  useEffect(() => {
    const trackingWindow = window as TrackingWindow
    trackingWindow.dataLayer = trackingWindow.dataLayer || []

    // Keep the ecommerce object clean before publishing the verified purchase.
    trackingWindow.dataLayer.push({ ecommerce: null })
    trackingWindow.dataLayer.push({
      event: 'purchase',
      ...(email ? { user_data: { email_address: email } } : {}),
      ecommerce: {
        transaction_id: transactionId,
        value,
        currency: 'USD',
        items: [
          {
            item_id: itemId,
            item_name: itemName,
            item_category: 'Play Pack',
            price: value,
            quantity: 1,
          },
        ],
      },
    })

    // Keep the existing direct Google Ads conversion authoritative until the
    // Purchase conversion is deliberately migrated into Tag Manager.
    const gtag = trackingWindow.gtag
    if (typeof gtag !== 'function') return

    gtag('event', 'conversion', {
      send_to: GOOGLE_ADS_PURCHASE_DESTINATION,
      value,
      currency: 'USD',
      transaction_id: transactionId,
    })
  }, [email, itemId, itemName, transactionId, value])

  return null
}
