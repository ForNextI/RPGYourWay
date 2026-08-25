import { redirect } from 'next/navigation'
import { AigmGameplayShell } from '@/components/aigm/aigm-gameplay-shell'
import { MotionPreferenceProvider } from '@/components/accessibility/motion-preference'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Play' }
export const dynamic = 'force-dynamic'

export default async function PlayPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  if (!data.user) redirect('/start')

  return (
    <MotionPreferenceProvider>
      <AigmGameplayShell />
    </MotionPreferenceProvider>
  )
}
