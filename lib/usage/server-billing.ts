import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { roundUsageMicrousdToCent, usageMicrousd } from '@/lib/usage/money'
import { isOwnerQaEmail } from '@/lib/usage/owner-qa'

export class UsageBillingError extends Error {
  status: number
  code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = 'UsageBillingError'
    this.status = status
    this.code = code
  }
}

export type UsageAccount = {
  supabase: SupabaseClient
  userId: string
  email: string | null
  ownerQa: boolean
}

export type UsageReservation = {
  account: UsageAccount
  holdId: string | null
  maximumMicrousd: number
  source: string
  sourceRef: string | null
  operationId: string
  feature: string
}

export async function requireUsageAccount(): Promise<UsageAccount> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw new UsageBillingError('Sign in to use Play.', 401, 'authentication_required')
  }
  const email = data.user.email ?? null
  return {
    supabase: supabase as unknown as SupabaseClient,
    userId: data.user.id,
    email,
    ownerQa: isOwnerQaEmail(email),
  }
}

function cleanOperationId(value: string | null | undefined) {
  const clean = (value || '').trim().replace(/[^a-zA-Z0-9:_-]+/g, '-').slice(0, 180)
  return clean || crypto.randomUUID()
}

export async function reserveUsage(
  account: UsageAccount,
  input: {
    maximumMicrousd: number
    feature: string
    sourceRef?: string | null
    operationId?: string | null
    holdMinutes?: number
  },
): Promise<UsageReservation> {
  const maximumMicrousd = Math.max(10_000, Math.trunc(input.maximumMicrousd || 0))
  const feature = input.feature.trim() || 'play'
  const sourceRef = input.sourceRef?.trim() || null
  const operationId = cleanOperationId(input.operationId)
  const holdMinutes = Math.max(1, Math.min(60, Math.trunc(input.holdMinutes || 10)))

  if (account.ownerQa) {
    return { account, holdId: null, maximumMicrousd, source: 'play', sourceRef, operationId, feature }
  }

  const { data, error } = await account.supabase.rpc('rpgyw_reserve_usage', {
    p_maximum_microusd: maximumMicrousd,
    p_source: 'play',
    p_source_ref: sourceRef,
    p_idempotency_key: `play:${feature}:${account.userId}:${operationId}`,
    p_expires_at: new Date(Date.now() + holdMinutes * 60 * 1000).toISOString(),
  })

  if (error || typeof data !== 'string') {
    const message = error?.message || 'RPG Your Way could not reserve usage for this request.'
    if (/insufficient/i.test(message)) {
      throw new UsageBillingError('Insufficient balance. Add usage from your Account page before starting this request.', 402, 'insufficient_balance')
    }
    throw new UsageBillingError(message, 503, 'billing_unavailable')
  }

  return { account, holdId: data, maximumMicrousd, source: 'play', sourceRef, operationId, feature }
}

async function recordProviderEvent(
  reservation: UsageReservation,
  input: {
    model: string
    providerCostMicrousd: number
    billedMicrousd: number
    success: boolean
    metadata?: Record<string, unknown>
  },
) {
  try {
    const admin = createAdminClient()
    await admin.from('provider_usage_events').insert({
      user_id: reservation.account.userId,
      surface: 'play',
      feature: reservation.feature,
      source_ref: reservation.sourceRef,
      operation_id: reservation.operationId,
      model: input.model,
      provider_cost_microusd: Math.max(0, Math.trunc(input.providerCostMicrousd || 0)),
      billed_microusd: Math.max(0, Math.trunc(input.billedMicrousd || 0)),
      owner_qa_exempt: reservation.account.ownerQa,
      success: input.success,
      metadata: input.metadata || {},
    })
  } catch (error) {
    console.error('Provider usage event could not be recorded.', error)
  }
}

export async function recordIncludedProviderUsage(
  account: UsageAccount,
  input: {
    feature: string
    operationId?: string | null
    sourceRef?: string | null
    model: string
    providerCostMicrousd: number
    success?: boolean
    metadata?: Record<string, unknown>
  },
) {
  const feature = input.feature.trim() || 'play_included'
  const operationId = cleanOperationId(input.operationId)
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('provider_usage_events').upsert({
      user_id: account.userId,
      surface: 'play',
      feature,
      source_ref: input.sourceRef?.trim() || null,
      operation_id: operationId,
      model: input.model,
      provider_cost_microusd: usageMicrousd(input.providerCostMicrousd),
      billed_microusd: 0,
      owner_qa_exempt: account.ownerQa,
      success: input.success !== false,
      metadata: { included_usage: true, ...(input.metadata || {}) },
    }, { onConflict: 'user_id,surface,feature,operation_id' })
    if (error) console.error('Included provider usage event could not be recorded.', error)
  } catch (error) {
    console.error('Included provider usage event could not be recorded.', error)
  }
}

export async function releaseUsage(
  reservation: UsageReservation | null | undefined,
  input: { model?: string; metadata?: Record<string, unknown> } = {},
) {
  if (!reservation) return
  if (reservation.holdId) {
    try {
      await reservation.account.supabase.rpc('rpgyw_release_usage', { p_hold_id: reservation.holdId })
    } catch {
      // Releasing a failed operation is best-effort; provider-event logging should still run.
    }
  }
  await recordProviderEvent(reservation, {
    model: input.model || 'unknown',
    providerCostMicrousd: 0,
    billedMicrousd: 0,
    success: false,
    metadata: input.metadata,
  })
}

export async function settleUsage(
  reservation: UsageReservation,
  input: {
    model: string
    providerCostMicrousd: number
    metadata?: Record<string, unknown>
  },
) {
  const providerCostMicrousd = usageMicrousd(input.providerCostMicrousd)
  const roundedCustomerCost = roundUsageMicrousdToCent(providerCostMicrousd)
  const billedMicrousd = reservation.account.ownerQa
    ? 0
    : Math.min(roundedCustomerCost, reservation.maximumMicrousd)

  let balanceMicrousd: number | null = null
  let settlementWarning = ''

  if (reservation.holdId) {
    const { data, error } = await reservation.account.supabase.rpc('rpgyw_capture_usage', {
      p_hold_id: reservation.holdId,
      p_actual_microusd: billedMicrousd,
      p_metadata: {
        surface: 'play',
        feature: reservation.feature,
        provider_cost_microusd: providerCostMicrousd,
        rounded_customer_cost_microusd: roundedCustomerCost,
        maximum_deduction_microusd: reservation.maximumMicrousd,
        billed_microusd: billedMicrousd,
        capped_at_maximum: roundedCustomerCost > reservation.maximumMicrousd,
        ...(input.metadata || {}),
      },
    })
    if (error) {
      settlementWarning = error.message
      try {
        await reservation.account.supabase.rpc('rpgyw_release_usage', { p_hold_id: reservation.holdId })
      } catch {
        // If capture failed, releasing the hold is best-effort; preserve the original settlement warning.
      }
    } else {
      balanceMicrousd = usageMicrousd(data)
    }
  }

  await recordProviderEvent(reservation, {
    model: input.model,
    providerCostMicrousd,
    billedMicrousd: settlementWarning ? 0 : billedMicrousd,
    success: true,
    metadata: {
      maximum_deduction_microusd: reservation.maximumMicrousd,
      rounded_customer_cost_microusd: roundedCustomerCost,
      settlement_warning: settlementWarning || null,
      ...(input.metadata || {}),
    },
  })

  return {
    providerCostMicrousd,
    billedMicrousd: settlementWarning ? 0 : billedMicrousd,
    balanceMicrousd,
    ownerQaExempt: reservation.account.ownerQa,
    settlementWarning: settlementWarning || null,
  }
}

export function billingErrorResponse(error: unknown) {
  if (error instanceof UsageBillingError) {
    return Response.json({
      error: error.message,
      code: error.code,
      add_usage_url: error.status === 402 ? '/account#add-usage' : undefined,
    }, { status: error.status, headers: { 'Cache-Control': 'no-store' } })
  }
  return Response.json({ error: error instanceof Error ? error.message : 'Usage billing is unavailable.' }, { status: 503 })
}
