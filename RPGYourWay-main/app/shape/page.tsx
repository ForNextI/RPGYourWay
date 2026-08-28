import { permanentRedirect } from 'next/navigation'

export const metadata = { title: 'Script' }

export default function LegacyShapePage() {
  permanentRedirect('/script')
}
