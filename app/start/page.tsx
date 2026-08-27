import { AuthPanel } from '@/components/AuthPanel'
import { PageShell } from '@/components/PageShell'
import { RpgywStartEntry } from '@/components/aigm/rpgyw-start-entry'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Start' }
export const dynamic = 'force-dynamic'

export default async function StartPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  if (!data.user) {
    return (
      <PageShell variant="play">
        <main id="main-content" tabIndex={-1} className="inner-main">
          <div className="shell narrow-shell play-signin-shell">
            <p className="kicker">Start</p>
            <h1 className="page-title">Sign in to start or import an adventure.</h1>
            <p className="page-lede">Build a new campaign here, or import an existing WardensPC or RPG Your Way adventure after you sign in.</p>
            <AuthPanel returnTo="/start" />
          </div>
        </main>
      </PageShell>
    )
  }

  return <RpgywStartEntry />
}
