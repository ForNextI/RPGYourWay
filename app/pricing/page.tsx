import { permanentRedirect } from 'next/navigation'

export default function PricingRedirect() {
  permanentRedirect('/account#add-usage')
}
