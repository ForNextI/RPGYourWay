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
  const addCharacterMode = firstQueryValue(params.addCharacter) === '1'
  const multiplayerPlayReturn = multiplayerCode ? `/play?multiplayer=${encodeURIComponent(multiplayerCode)}` : '/play'
  const startReturn = addCharacterMode
    ? `/start?addCharacter=1${multiplayerCode ? `&multiplayer=${encodeURIComponent(multiplayerCode)}` : ''}`
    : multiplayerCode ? multiplayerPlayReturn : '/start'

  if (data.user && multiplayerCode && !addCharacterMode) redirect(multiplayerPlayReturn)

  if (!data.user) {
    const authStatus = firstQueryValue(params.authStatus)
    const authError = firstQueryValue(params.authError)
    return (
      <PageShell variant="play">
        <main id="main-content" tabIndex={-1} className="inner-main">
          <div className="shell narrow-shell play-signin-shell">
            <p className="kicker">Start</p>
            <h1 className="page-title">{addCharacterMode ? 'Sign in to add characters to your campaign.' : multiplayerCode ? 'Sign in to join the multiplayer table.' : 'Sign in to start or import an adventure.'}</h1>
            <p className="page-lede">{addCharacterMode ? 'Your existing campaign stays intact. Sign in, add the new party members, and return to Play.' : multiplayerCode ? 'Every multiplayer participant uses their own RPG Your Way account. Sign in or create one, then this invite will take you directly to the table.' : 'Build a new campaign here, or import an existing WardensPC or RPG Your Way adventure after you sign in.'}</p>
            <AuthPanel returnTo={startReturn} status={authStatus} error={authError} />
          </div>
        </main>
      </PageShell>
    )
  }

  return <RpgywStartEntry addCharacterMode={addCharacterMode} multiplayerCode={multiplayerCode} />
}
