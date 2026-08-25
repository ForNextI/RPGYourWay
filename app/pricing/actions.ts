'use server'

import { redirect } from 'next/navigation'
import { playPackById } from '@/lib/billing/play-packs'
import { createClient } from '@/lib/supabase/server'
import { createPlayPackCheckoutSession } from '@/lib/stripe/server'

export async function beginPlayPackCheckout(formData: FormData) {
  const pack = playPackById(formData.get('pack'))
  if (!pack) redirect('/account?error=Unknown+Play+Pack#add-usage')

  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) redirect('/account?error=Sign+in+before+buying+a+Play+Pack.#sign-in')

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
    redirect(`/account?error=${encodeURIComponent(message)}#add-usage`)
  }

  if (!checkoutUrl) redirect('/account?error=Stripe+checkout+did+not+return+a+payment+page.#add-usage')
  redirect(checkoutUrl)
}
