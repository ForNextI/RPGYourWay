'use server'

import { redirect } from 'next/navigation'
import { playPackById } from '@/lib/billing/play-packs'
import { createClient } from '@/lib/supabase/server'
import { createPlayPackCheckoutSession } from '@/lib/stripe/server'

export async function beginPlayPackCheckout(formData: FormData) {
  const pack = playPackById(formData.get('pack'))
  if (!pack) redirect('/pricing?error=Unknown+Play+Pack')

  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) redirect('/account?error=Sign+in+before+buying+a+Play+Pack.')

  let checkoutUrl = ''
  try {
    const session = await createPlayPackCheckoutSession({
      userId: data.user.id,
      email: data.user.email,
      pack,
    })
    checkoutUrl = session.url || ''
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Stripe checkout could not start.'
    redirect(`/pricing?error=${encodeURIComponent(message)}`)
  }

  if (!checkoutUrl) redirect('/pricing?error=Stripe+checkout+did+not+return+a+payment+page.')
  redirect(checkoutUrl)
}
