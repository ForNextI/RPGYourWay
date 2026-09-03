import { redirect } from 'next/navigation'
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
  const signedIn = Boolean(data.user)

  // Ordinary campaign creation is deliberately browse-first in 3.0.0.
  // Joining an existing multiplayer table or editing an existing cloud campaign
  // still requires the account that owns/joins that persistent campaign.
  if (!signedIn && (multiplayerCode || addCharacterMode)) redirect('/account#sign-in')
  if (signedIn && multiplayerCode && !addCharacterMode) redirect(multiplayerPlayReturn)

  return <RpgywStartEntry addCharacterMode={addCharacterMode} multiplayerCode={multiplayerCode} signedIn={signedIn} />
}
