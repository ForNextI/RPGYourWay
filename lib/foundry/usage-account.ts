import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { isOwnerQaEmail } from '@/lib/usage/owner-qa'
import type { UsageAccount } from '@/lib/usage/server-billing'
import {
  FoundryIntegrationError,
  requireFoundryPlayerSession,
} from '@/lib/foundry/server'

export async function requireFoundryUsageAccount(request: Request): Promise<{
  account: UsageAccount
  user: User
  playerLink: Awaited<ReturnType<typeof requireFoundryPlayerSession>>['playerLink']
  connection: Awaited<ReturnType<typeof requireFoundryPlayerSession>>['connection']
  campaign: Awaited<ReturnType<typeof requireFoundryPlayerSession>>['campaign']
}> {
  const session = await requireFoundryPlayerSession(request)
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.getUserById(
    session.playerLink.rpg_user_id as string,
  )

  if (error || !data.user) {
    throw new FoundryIntegrationError(
      'The RPG Your Way account linked to this Foundry player is no longer available.',
      401,
      'linked_account_unavailable',
    )
  }

  const email = data.user.email ?? null
  const account: UsageAccount = {
    supabase: admin as unknown as SupabaseClient,
    userId: data.user.id,
    email,
    ownerQa: isOwnerQaEmail(email),
  }

  return {
    account,
    user: data.user,
    playerLink: session.playerLink,
    connection: session.connection,
    campaign: session.campaign,
  }
}
