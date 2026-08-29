import { createAdminClient } from '@/lib/supabase/admin'
import { loadSessionByInvite } from '@/lib/multiplayer/server'
import { MultiplayerError } from '@/lib/multiplayer/errors'
import { isOwnerQaEmail } from '@/lib/usage/owner-qa'
import { UsageBillingError, type UsageAccount } from '@/lib/usage/server-billing'
import { usageMicrousd } from '@/lib/usage/money'
import { aggregateMultiplayerPayerShares, evenlyAllocateMultiplayerCharge } from '@/lib/multiplayer/charge-allocation'

const ACTIVE_SEAT_WINDOW_MS = 90_000

type FrozenSeat = {
  seatId: string
  userId: string
  payerUserId: string
  displayName: string
}

type ChargeRow = {
  payer_user_id: string
  seat_count: number
  maximum_microusd: number | string
  usage_hold_id: string | null
  owner_qa_exempt: boolean
  status: 'pending' | 'held' | 'settled' | 'released' | 'error'
}

type TurnBillingRow = {
  id: string
  session_id: string
  campaign_id: string
  submitted_by_user_id: string
  expected_campaign_revision: number | string
  turn_status: 'pending' | 'held' | 'ai_complete' | 'committed' | 'released' | 'failed'
  billing_status: 'pending' | 'held' | 'settled' | 'released' | 'error'
  seat_snapshot: unknown
  maximum_total_microusd: number | string
}

async function payerOwnerQa(userId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error) throw new UsageBillingError('RPG Your Way could not verify a multiplayer payer.', 503, 'billing_unavailable')
  return isOwnerQaEmail(data.user?.email ?? null)
}

async function releaseHold(userId: string, holdId: string | null) {
  if (!holdId) return
  const admin = createAdminClient()
  try {
    await admin.rpc('rpgyw_release_usage_for_user', { p_user_id: userId, p_hold_id: holdId })
  } catch {
    // Best-effort cleanup. The hold also expires server-side.
  }
}

export async function reserveMultiplayerTurnBilling(
  account: UsageAccount,
  input: { inviteCode: string; turnId: string; campaignId: string; expectedRevision: number; maximumTotalMicrousd: number },
) {
  const lobby = await loadSessionByInvite(input.inviteCode, account.userId)
  if (!lobby.isMember || !lobby.selfSeatId || !lobby.campaignId) throw new MultiplayerError('Join this multiplayer campaign before sending a turn.', 403, 'membership_required')
  if (lobby.campaignId !== input.campaignId) throw new MultiplayerError('That multiplayer table belongs to a different cloud campaign.', 409, 'campaign_mismatch')

  const admin = createAdminClient()
  const { data: turnData, error: turnError } = await admin
    .from('multiplayer_turns')
    .select('id,session_id,campaign_id,submitted_by_user_id,expected_campaign_revision,turn_status,billing_status,seat_snapshot,maximum_total_microusd')
    .eq('id', input.turnId)
    .eq('session_id', lobby.id)
    .eq('campaign_id', lobby.campaignId)
    .maybeSingle()
  if (turnError || !turnData) throw new MultiplayerError(turnError?.message || 'Reserve the multiplayer turn before sending it.', 409, 'turn_not_reserved')
  const turn = turnData as TurnBillingRow
  if (turn.submitted_by_user_id !== account.userId) throw new MultiplayerError('That multiplayer turn belongs to another player.', 403, 'turn_owner_mismatch')
  const expectedRevision = Number(input.expectedRevision)
  if (!Number.isFinite(expectedRevision) || expectedRevision < 1 || Number(turn.expected_campaign_revision) !== Math.trunc(expectedRevision)) throw new MultiplayerError('The campaign changed before this multiplayer turn reached the Game Master. Reload the shared campaign and try again.', 409, 'revision_conflict')
  if (turn.billing_status === 'held' || turn.billing_status === 'settled') return { maximumTotalMicrousd: usageMicrousd(turn.maximum_total_microusd) }
  if (turn.turn_status === 'released' || turn.turn_status === 'failed') throw new MultiplayerError('That multiplayer turn is no longer active.', 409, 'turn_not_active')

  const activeAfter = new Date(Date.now() - ACTIVE_SEAT_WINDOW_MS).toISOString()
  const { data: seatsData, error: seatsError } = await admin
    .from('multiplayer_seats')
    .select('id,user_id,payer_user_id,display_name,joined_at,last_seen_at')
    .eq('session_id', lobby.id)
    .eq('is_active', true)
    .gte('last_seen_at', activeAfter)
    .order('joined_at', { ascending: true })
  if (seatsError) throw new UsageBillingError(seatsError.message, 503, 'billing_unavailable')
  const seats: FrozenSeat[] = (seatsData || []).map((row: { id: string; user_id: string; payer_user_id: string; display_name: string }) => ({
    seatId: row.id,
    userId: row.user_id,
    payerUserId: row.payer_user_id,
    displayName: row.display_name,
  }))
  if (!seats.some((seat) => seat.userId === account.userId)) throw new MultiplayerError('Your multiplayer seat is no longer active. Reopen the table and try again.', 409, 'seat_not_active')
  if (!seats.length) throw new MultiplayerError('No active multiplayer seats are available for this turn.', 409, 'no_active_seats')

  const maximumTotalMicrousd = Math.max(10_000, Math.trunc(input.maximumTotalMicrousd || 0))
  const payerMaximums = aggregateMultiplayerPayerShares(seats, evenlyAllocateMultiplayerCharge(maximumTotalMicrousd, seats.length))
  const reserved: Array<{ payerUserId: string; holdId: string | null }> = []

  try {
    for (const [payerUserId, maximumMicrousd] of payerMaximums) {
      const ownerQa = await payerOwnerQa(payerUserId)
      let holdId: string | null = null
      if (!ownerQa) {
        const { data, error } = await admin.rpc('rpgyw_reserve_usage_for_user', {
          p_user_id: payerUserId,
          p_maximum_microusd: maximumMicrousd,
          p_source: 'play',
          p_source_ref: `${lobby.campaignId}:multiplayer:${input.turnId}`,
          p_idempotency_key: `multiplayer:${input.turnId}:${payerUserId}`,
          p_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        })
        if (error || typeof data !== 'string') {
          const message = error?.message || 'RPG Your Way could not reserve multiplayer usage.'
          if (/insufficient/i.test(message)) throw new UsageBillingError('One of the active players does not have enough usage balance for their share of this turn. That player needs to add usage before the table continues.', 402, 'insufficient_balance')
          throw new UsageBillingError(message, 503, 'billing_unavailable')
        }
        holdId = data
      }
      reserved.push({ payerUserId, holdId })
      const seatCount = seats.filter((seat) => seat.payerUserId === payerUserId).length
      const { error: chargeError } = await admin.from('multiplayer_turn_charges').upsert({
        turn_id: input.turnId,
        payer_user_id: payerUserId,
        seat_count: seatCount,
        maximum_microusd: maximumMicrousd,
        usage_hold_id: holdId,
        owner_qa_exempt: ownerQa,
        status: 'held',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'turn_id,payer_user_id' })
      if (chargeError) throw new UsageBillingError(chargeError.message, 503, 'billing_unavailable')
    }

    const { error: updateError } = await admin.from('multiplayer_turns').update({
      turn_status: 'held',
      billing_status: 'held',
      seat_snapshot: seats,
      maximum_total_microusd: maximumTotalMicrousd,
      lease_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', input.turnId).eq('submitted_by_user_id', account.userId)
    if (updateError) throw new UsageBillingError(updateError.message, 503, 'billing_unavailable')
    return { maximumTotalMicrousd }
  } catch (error) {
    await Promise.all(reserved.map((entry) => releaseHold(entry.payerUserId, entry.holdId)))
    await admin.from('multiplayer_turn_charges').update({ status: 'released', updated_at: new Date().toISOString() }).eq('turn_id', input.turnId)
    await admin.from('multiplayer_turns').update({ billing_status: 'released', turn_status: 'released', settlement_warning: error instanceof Error ? error.message : 'Reservation failed.', updated_at: new Date().toISOString() }).eq('id', input.turnId)
    throw error
  }
}

export async function markMultiplayerAiComplete(turnId: string) {
  const admin = createAdminClient()
  await admin.from('multiplayer_turns').update({ turn_status: 'ai_complete', lease_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() })
    .eq('id', turnId)
    .in('turn_status', ['pending', 'held'])
}

export async function releaseMultiplayerTurnBilling(turnId: string, warning?: string | null) {
  const admin = createAdminClient()
  const { data } = await admin.from('multiplayer_turn_charges').select('payer_user_id,usage_hold_id,status').eq('turn_id', turnId)
  const rows = (data || []) as Array<{ payer_user_id: string; usage_hold_id: string | null; status: string }>
  await Promise.all(rows.filter((row) => row.status === 'held').map((row) => releaseHold(row.payer_user_id, row.usage_hold_id)))
  await admin.from('multiplayer_turn_charges').update({ status: 'released', updated_at: new Date().toISOString() }).eq('turn_id', turnId).neq('status', 'settled')
  await admin.from('multiplayer_turns').update({ turn_status: 'released', billing_status: 'released', settlement_warning: warning || null, updated_at: new Date().toISOString() }).eq('id', turnId).neq('turn_status', 'committed')
}

function categoryBySeat(total: number, seats: FrozenSeat[]) {
  return aggregateMultiplayerPayerShares(seats, evenlyAllocateMultiplayerCharge(total, seats.length))
}

export async function settleMultiplayerTurnBilling(
  account: UsageAccount,
  input: {
    turnId: string
    providerCosts: { ttt: number; gameplay: number; tts: number }
    billedCategories: { ttt: number; gameplay: number; tts: number }
    roundedCustomerCost: number
  },
) {
  const admin = createAdminClient()
  const { data: turnData, error: turnError } = await admin
    .from('multiplayer_turns')
    .select('id,submitted_by_user_id,billing_status,seat_snapshot,maximum_total_microusd,billed_total_microusd')
    .eq('id', input.turnId)
    .maybeSingle()
  if (turnError || !turnData) throw new Error(turnError?.message || 'Multiplayer billing record is unavailable.')
  if (turnData.submitted_by_user_id !== account.userId) throw new Error('Multiplayer billing record belongs to another account.')
  if (turnData.billing_status === 'settled') {
    const { data: selfCharge } = await admin.from('multiplayer_turn_charges').select('balance_after_microusd,owner_qa_exempt').eq('turn_id', input.turnId).eq('payer_user_id', account.userId).maybeSingle()
    return { billedMicrousd: usageMicrousd(turnData.billed_total_microusd), balanceMicrousd: selfCharge?.balance_after_microusd == null ? null : usageMicrousd(selfCharge.balance_after_microusd), ownerQaExempt: selfCharge?.owner_qa_exempt === true, settlementWarning: null }
  }

  const seats = Array.isArray(turnData.seat_snapshot) ? turnData.seat_snapshot as FrozenSeat[] : []
  if (!seats.length) throw new Error('Multiplayer turn has no frozen payer roster.')
  const maximumTotal = usageMicrousd(turnData.maximum_total_microusd)
  const billedBeforeExemptions = Math.min(usageMicrousd(input.roundedCustomerCost), maximumTotal)
  const payerTotals = aggregateMultiplayerPayerShares(seats, evenlyAllocateMultiplayerCharge(billedBeforeExemptions, seats.length))
  const payerTtt = categoryBySeat(input.billedCategories.ttt, seats)
  const payerTts = categoryBySeat(input.billedCategories.tts, seats)

  const { data: chargeData, error: chargeError } = await admin.from('multiplayer_turn_charges')
    .select('payer_user_id,seat_count,maximum_microusd,usage_hold_id,owner_qa_exempt,status')
    .eq('turn_id', input.turnId)
  if (chargeError) throw new Error(chargeError.message)
  const charges = (chargeData || []) as ChargeRow[]
  const captures = charges.map((charge) => {
    const requested = Math.min(payerTotals.get(charge.payer_user_id) || 0, usageMicrousd(charge.maximum_microusd))
    const payerBilled = charge.owner_qa_exempt ? 0 : requested
    const ttt = charge.owner_qa_exempt ? 0 : Math.min(payerTtt.get(charge.payer_user_id) || 0, payerBilled)
    const tts = charge.owner_qa_exempt ? 0 : Math.min(payerTts.get(charge.payer_user_id) || 0, Math.max(0, payerBilled - ttt))
    const gameplay = charge.owner_qa_exempt ? 0 : Math.max(0, payerBilled - ttt - tts)
    return {
      payer_user_id: charge.payer_user_id,
      billed_microusd: payerBilled,
      ttt_billed_microusd: ttt,
      gameplay_billed_microusd: gameplay,
      tts_billed_microusd: tts,
    }
  })

  // Capture the frozen payer roster in one Postgres transaction. If any payer
  // cannot be settled, nobody is partially debited for the shared turn.
  const { data: settledTotal, error: settleError } = await admin.rpc('rpgyw_capture_multiplayer_turn', {
    p_turn_id: input.turnId,
    p_provider_total_microusd: input.providerCosts.ttt + input.providerCosts.gameplay + input.providerCosts.tts,
    p_ttt_provider_microusd: input.providerCosts.ttt,
    p_gameplay_provider_microusd: input.providerCosts.gameplay,
    p_tts_provider_microusd: input.providerCosts.tts,
    p_captures: captures,
  })
  if (settleError) {
    const settlementWarning = settleError.message || 'Multiplayer usage could not be settled.'
    await admin.from('multiplayer_turns').update({ settlement_warning: settlementWarning, updated_at: new Date().toISOString() }).eq('id', input.turnId)
    return {
      billedMicrousd: 0,
      balanceMicrousd: null,
      ownerQaExempt: account.ownerQa,
      settlementWarning,
    }
  }

  const actualBilledTotal = usageMicrousd(settledTotal)
  const { data: selfCharge } = await admin.from('multiplayer_turn_charges')
    .select('balance_after_microusd')
    .eq('turn_id', input.turnId)
    .eq('payer_user_id', account.userId)
    .maybeSingle()
  const selfBalance = selfCharge?.balance_after_microusd == null ? null : usageMicrousd(selfCharge.balance_after_microusd)

  return {
    billedMicrousd: actualBilledTotal,
    balanceMicrousd: selfBalance,
    ownerQaExempt: account.ownerQa,
    settlementWarning: null,
  }
}
