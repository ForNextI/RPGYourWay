import { redirect } from 'next/navigation'
import { AigmGameplayShell } from '@/components/aigm/aigm-gameplay-shell'
import { SiteHeader } from '@/components/SiteHeader'
import { MotionPreferenceProvider } from '@/components/accessibility/motion-preference'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Play' }
export const dynamic = 'force-dynamic'

type PlaySearchParams = Promise<Record<string, string | string[] | undefined>>

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

export default async function PlayPage({ searchParams }: { searchParams: PlaySearchParams }) {
  const supabase = await createClient()
  const [{ data }, params] = await Promise.all([supabase.auth.getUser(), searchParams])
  const multiplayerCode = firstQueryValue(params.multiplayer).trim().slice(0, 96)

  if (!data.user && !multiplayerCode) redirect('/start')
  if (!data.user) {
    const query = new URLSearchParams({ multiplayer: multiplayerCode })
    const authStatus = firstQueryValue(params.authStatus)
    const authError = firstQueryValue(params.authError)
    if (authStatus) query.set('authStatus', authStatus)
    if (authError) query.set('authError', authError)
    redirect(`/start?${query.toString()}`)
  }

  return (
    <div className="site-frame site-frame-play play-page-frame">
      <SiteHeader />
      <MotionPreferenceProvider>
        <AigmGameplayShell />
      </MotionPreferenceProvider>
    </div>
  )
}
