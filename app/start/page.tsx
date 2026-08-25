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
            <p className="page-lede">Existing WardensPC adventures can be imported here. New-adventure onboarding will also live on Start as it is rebuilt.</p>
            <AuthPanel returnTo="/start" />
          </div>
        </main>
      </PageShell>
    )
  }

  return <RpgywStartEntry />
}
