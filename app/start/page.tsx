import { redirect } from 'next/navigation'
import { AuthPanel } from '@/components/AuthPanel'
import { PageShell } from '@/components/PageShell'
import { RpgywStartEntry } from '@/components/aigm/rpgyw-start-entry'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Start' }
export const dynamic = 'force-dynamic'

type StartSearchParams = Promise<Record<string, string | string[] | undefined>>

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

export default async function StartPage({ searchParams }: { searchParams: StartSearchParams }) {
  const supabase = await createClient()
  const [{ data }, params] = await Promise.all([supabase.auth.getUser(), searchParams])
  const multiplayerCode = firstQueryValue(params.multiplayer).trim().slice(0, 96)
  const multiplayerReturnTo = multiplayerCode ? `/play?multiplayer=${encodeURIComponent(multiplayerCode)}` : '/start'

  if (data.user && multiplayerCode) redirect(multiplayerReturnTo)

  if (!data.user) {
    const authStatus = firstQueryValue(params.authStatus)
    const authError = firstQueryValue(params.authError)
    return (
      <PageShell variant="play">
        <main id="main-content" tabIndex={-1} className="inner-main">
          <div className="shell narrow-shell play-signin-shell">
            <p className="kicker">Start</p>
            <h1 className="page-title">{multiplayerCode ? 'Sign in to join the multiplayer table.' : 'Sign in to start or import an adventure.'}</h1>
            <p className="page-lede">{multiplayerCode ? 'Every multiplayer participant uses their own RPG Your Way account. Sign in or create one, then this invite will take you directly to the table.' : 'Build a new campaign here, or import an existing WardensPC or RPG Your Way adventure after you sign in.'}</p>
            <AuthPanel returnTo={multiplayerReturnTo} status={authStatus} error={authError} />
          </div>
        </main>
      </PageShell>
    )
  }

  return <RpgywStartEntry />
}
