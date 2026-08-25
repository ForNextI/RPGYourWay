import { createClient } from '@/lib/supabase/server'
import { formatUsageDollars, usageMicrousd } from '@/lib/usage/money'
import { isOwnerQaEmail } from '@/lib/usage/owner-qa'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return Response.json({ error: 'Sign in to see your RPG Your Way usage balance.' }, { status: 401 })
  }

  // This also releases any quote that expired after an abandoned request.
  await supabase.rpc('rpgyw_release_expired_usage')

  const { data, error } = await supabase
    .from('usage_wallets')
    .select('balance_microusd,reserved_microusd,lifetime_credited_microusd,lifetime_debited_microusd,updated_at')
    .eq('user_id', authData.user.id)
    .maybeSingle()

  if (error || !data) {
    return Response.json({ error: 'The shared usage balance is not ready for this account yet.' }, { status: 503 })
  }

  const ownerQa = isOwnerQaEmail(authData.user.email)
  const balance = usageMicrousd(data.balance_microusd)
  const reserved = usageMicrousd(data.reserved_microusd)
  const available = Math.max(0, balance - reserved)

  return Response.json({
    balance_microusd: balance,
    reserved_microusd: reserved,
    available_microusd: available,
    available_display: formatUsageDollars(available),
    balance_display: formatUsageDollars(balance),
    owner_qa_exempt: ownerQa,
    updated_at: data.updated_at,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
