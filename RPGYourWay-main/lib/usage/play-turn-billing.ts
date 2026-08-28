import { createAdminClient } from '@/lib/supabase/admin'
import { roundUsageMicrousdToCent, usageMicrousd } from '@/lib/usage/money'
import { reserveUsage, type UsageAccount, type UsageReservation } from '@/lib/usage/server-billing'
import { ttsReserveMicrousd } from '@/lib/usage/audio-cost'

export type PlayTurnKind = 'live' | 'replay'
export type PlayTurnComponentType = 'ttt' | 'gameplay' | 'tts'
export type PlayTurnComponentStatus = 'pending' | 'success' | 'failed'

export type PlayTurnSettlement = {
  settled: boolean
  pending: boolean
  billedMicrousd: number
  balanceMicrousd: number | null
  ownerQaExempt: boolean
  settlementWarning: string | null
}

type TurnRow = {
  id: string
  user_id: string
  kind: PlayTurnKind
  source_ref: string | null
  status: 'pending' | 'held' | 'settled' | 'released' | 'error'
  usage_hold_id: string | null
  maximum_microusd: number | string | null
  owner_qa_exempt: boolean
  narration_expected: boolean
  gameplay_complete: boolean
  audio_complete_requested: boolean
  expected_tts_components: number | string | null
  ttt_provider_microusd: number | string | null
  gameplay_provider_microusd: number | string | null
  tts_provider_microusd: number | string | null
  provider_total_microusd: number | string | null
  billed_microusd: number | string | null
  ttt_billed_microusd: number | string | null
  gameplay_billed_microusd: number | string | null
  tts_billed_microusd: number | string | null
  balance_after_microusd: number | string | null
  settlement_warning: string | null
}

type ComponentRow = {
  component_id: string
  component_type: PlayTurnComponentType
  status: PlayTurnComponentStatus
  provider_cost_microusd: number | string | null
}

function cleanId(value: string | null | undefined) {
  const clean = (value || '').trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean) ? clean : null
}

function cleanComponentId(value: string | null | undefined) {
  const clean = (value || '').trim().replace(/[^a-zA-Z0-9:_-]+/g, '-').slice(0, 180)
  return clean || crypto.randomUUID()
}

function featureFor(type: PlayTurnComponentType) {
  if (type === 'ttt') return 'talk-to-text'
  if (type === 'tts') return 'tts'
  return 'gameplay'
}

async function turnFor(account: UsageAccount, turnId: string): Promise<TurnRow> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('play_turn_billing')
    .select('id,user_id,kind,source_ref,status,usage_hold_id,maximum_microusd,owner_qa_exempt,narration_expected,gameplay_complete,audio_complete_requested,expected_tts_components,ttt_provider_microusd,gameplay_provider_microusd,tts_provider_microusd,provider_total_microusd,billed_microusd,ttt_billed_microusd,gameplay_billed_microusd,tts_billed_microusd,balance_after_microusd,settlement_warning')
    .eq('id', turnId)
    .maybeSingle()
  if (error || !data) throw new Error(error?.message || 'Play turn billing record is unavailable.')
  const row = data as TurnRow
  if (row.user_id !== account.userId) throw new Error('Play turn billing record belongs to another account.')
  return row
}

export async function ensurePlayTurn(
  account: UsageAccount,
  input: { turnId: string; kind?: PlayTurnKind; sourceRef?: string | null },
) {
  const turnId = cleanId(input.turnId)
  if (!turnId) throw new Error('A valid Play turn billing id is required.')
  const kind = input.kind || 'live'
  const admin = createAdminClient()
  const { error } = await admin.from('play_turn_billing').upsert({
    id: turnId,
    user_id: account.userId,
    kind,
    source_ref: input.sourceRef?.trim() || null,
    owner_qa_exempt: account.ownerQa,
    gameplay_complete: kind === 'replay',
    narration_expected: kind === 'replay',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id', ignoreDuplicates: true })
  if (error) throw new Error(`Play turn billing could not be prepared: ${error.message}`)
  const row = await turnFor(account, turnId)
  if (row.kind !== kind) throw new Error('Play turn billing id was reused for a different operation type.')
  return row
}

export async function successfulProviderCostSoFar(account: UsageAccount, turnId: string) {
  await ensurePlayTurn(account, { turnId, kind: 'live' })
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('play_turn_components')
    .select('provider_cost_microusd')
    .eq('turn_id', turnId)
    .eq('user_id', account.userId)
    .eq('status', 'success')
  if (error) throw new Error(`Play turn provider cost could not be read: ${error.message}`)
  return (data || []).reduce((sum, row) => sum + usageMicrousd(row.provider_cost_microusd), 0)
}

export async function attachPlayTurnReservation(
  account: UsageAccount,
  turnId: string,
  reservation: UsageReservation,
  narrationExpected: boolean,
) {
  await ensurePlayTurn(account, { turnId, kind: 'live', sourceRef: reservation.sourceRef })
  const admin = createAdminClient()
  const { error } = await admin.from('play_turn_billing').update({
    usage_hold_id: reservation.holdId,
    maximum_microusd: reservation.maximumMicrousd,
    narration_expected: narrationExpected,
    status: reservation.holdId || account.ownerQa ? 'held' : 'pending',
    updated_at: new Date().toISOString(),
  }).eq('id', turnId).eq('user_id', account.userId)
  if (error) throw new Error(`Play turn reservation could not be attached: ${error.message}`)
}

export async function ensureReplayReservation(account: UsageAccount, turnId: string) {
  const turn = await ensurePlayTurn(account, { turnId, kind: 'replay', sourceRef: 'manual-readback' })
  if (turn.status === 'settled') return turn
  if (turn.usage_hold_id || account.ownerQa) return turn

  const reservation = await reserveUsage(account, {
    maximumMicrousd: ttsReserveMicrousd(),
    feature: 'tts-replay',
    sourceRef: 'manual-readback',
    operationId: turnId,
    holdMinutes: 30,
  })
  const admin = createAdminClient()
  const { error } = await admin.from('play_turn_billing').update({
    usage_hold_id: reservation.holdId,
    maximum_microusd: reservation.maximumMicrousd,
    status: 'held',
    gameplay_complete: true,
    narration_expected: true,
    updated_at: new Date().toISOString(),
  }).eq('id', turnId).eq('user_id', account.userId)
  if (error) throw new Error(`Readback reservation could not be attached: ${error.message}`)
  return turnFor(account, turnId)
}

export async function recordPlayTurnComponent(
  account: UsageAccount,
  input: {
    turnId: string
    componentId?: string | null
    componentType: PlayTurnComponentType
    status: PlayTurnComponentStatus
    model: string
    providerCostMicrousd?: number
    metadata?: Record<string, unknown>
    kind?: PlayTurnKind
  },
) {
  const turnId = cleanId(input.turnId)
  if (!turnId) throw new Error('A valid Play turn billing id is required.')
  const componentId = cleanComponentId(input.componentId)
  await ensurePlayTurn(account, { turnId, kind: input.kind || 'live' })
  const providerCostMicrousd = input.status === 'pending' ? 0 : usageMicrousd(input.providerCostMicrousd)
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { error } = await admin.from('play_turn_components').upsert({
    turn_id: turnId,
    user_id: account.userId,
    component_id: componentId,
    component_type: input.componentType,
    status: input.status,
    model: input.model,
    provider_cost_microusd: providerCostMicrousd,
    metadata: input.metadata || {},
    updated_at: now,
  }, { onConflict: 'turn_id,component_id' })
  if (error) throw new Error(`Play turn component could not be recorded: ${error.message}`)

  if (input.status !== 'pending') {
    const { error: eventError } = await admin.from('provider_usage_events').upsert({
      user_id: account.userId,
      surface: 'play',
      feature: featureFor(input.componentType),
      source_ref: null,
      operation_id: componentId,
      turn_id: turnId,
      component_id: componentId,
      model: input.model,
      provider_cost_microusd: providerCostMicrousd,
      billed_microusd: 0,
      owner_qa_exempt: account.ownerQa,
      success: input.status === 'success',
      metadata: input.metadata || {},
    }, { onConflict: 'user_id,surface,feature,operation_id' })
    if (eventError) console.error('Play turn provider event could not be recorded.', eventError)
  }

  return componentId
}

export async function markGameplayComplete(account: UsageAccount, turnId: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('play_turn_billing').update({
    gameplay_complete: true,
    updated_at: new Date().toISOString(),
  }).eq('id', turnId).eq('user_id', account.userId)
  if (error) throw new Error(`Play turn could not be marked gameplay-complete: ${error.message}`)
}

export async function markPlayTurnReleased(account: UsageAccount, turnId: string, warning?: string | null) {
  const id = cleanId(turnId)
  if (!id) return
  const admin = createAdminClient()
  await admin.from('play_turn_billing').update({
    status: 'released',
    settlement_warning: warning || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id).eq('user_id', account.userId).neq('status', 'settled')
}

function allocateBilled(totalBilled: number, costs: { ttt: number; gameplay: number; tts: number }) {
  const providerTotal = costs.ttt + costs.gameplay + costs.tts
  if (!totalBilled || !providerTotal) return { ttt: 0, gameplay: 0, tts: 0 }
  let ttt = Math.floor(totalBilled * costs.ttt / providerTotal)
  let tts = Math.floor(totalBilled * costs.tts / providerTotal)
  let gameplay = totalBilled - ttt - tts
  if (costs.gameplay === 0 && gameplay > 0) {
    if (costs.tts >= costs.ttt) tts += gameplay
    else ttt += gameplay
    gameplay = 0
  }
  return { ttt, gameplay, tts }
}

async function updateEventAllocations(
  account: UsageAccount,
  turnId: string,
  components: ComponentRow[],
  categoryBilled: { ttt: number; gameplay: number; tts: number },
) {
  const admin = createAdminClient()
  for (const type of ['ttt', 'gameplay', 'tts'] as const) {
    const success = components.filter((component) => component.component_type === type && component.status === 'success')
    const providerTotal = success.reduce((sum, component) => sum + usageMicrousd(component.provider_cost_microusd), 0)
    let remaining = categoryBilled[type]
    for (let index = 0; index < success.length; index += 1) {
      const component = success[index]
      const cost = usageMicrousd(component.provider_cost_microusd)
      const allocated = index === success.length - 1
        ? remaining
        : providerTotal > 0
          ? Math.min(remaining, Math.floor(categoryBilled[type] * cost / providerTotal))
          : 0
      remaining -= allocated
      await admin.from('provider_usage_events').update({ billed_microusd: Math.max(0, allocated) })
        .eq('user_id', account.userId)
        .eq('turn_id', turnId)
        .eq('component_id', component.component_id)
    }
  }
}

export async function maybeSettlePlayTurn(account: UsageAccount, turnId: string): Promise<PlayTurnSettlement> {
  const turn = await turnFor(account, turnId)
  if (turn.status === 'settled') {
    return {
      settled: true,
      pending: false,
      billedMicrousd: usageMicrousd(turn.billed_microusd),
      balanceMicrousd: turn.balance_after_microusd === null ? null : usageMicrousd(turn.balance_after_microusd),
      ownerQaExempt: turn.owner_qa_exempt,
      settlementWarning: turn.settlement_warning || null,
    }
  }
  if (turn.status === 'released' || turn.status === 'error') {
    return { settled: false, pending: false, billedMicrousd: 0, balanceMicrousd: null, ownerQaExempt: turn.owner_qa_exempt, settlementWarning: turn.settlement_warning || null }
  }
  if (!turn.gameplay_complete || !turn.audio_complete_requested) {
    return { settled: false, pending: true, billedMicrousd: 0, balanceMicrousd: null, ownerQaExempt: turn.owner_qa_exempt, settlementWarning: null }
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('play_turn_components')
    .select('component_id,component_type,status,provider_cost_microusd')
    .eq('turn_id', turnId)
    .eq('user_id', account.userId)
  if (error) throw new Error(`Play turn components could not be read: ${error.message}`)
  const components = (data || []) as ComponentRow[]
  const expectedTts = Math.max(0, Number(turn.expected_tts_components || 0))
  const ttsComponents = components.filter((component) => component.component_type === 'tts')
  const terminalTts = ttsComponents.filter((component) => component.status !== 'pending')
  if (ttsComponents.some((component) => component.status === 'pending') || terminalTts.length < expectedTts) {
    return { settled: false, pending: true, billedMicrousd: 0, balanceMicrousd: null, ownerQaExempt: turn.owner_qa_exempt, settlementWarning: null }
  }

  const successful = components.filter((component) => component.status === 'success')
  const costs = {
    ttt: successful.filter((component) => component.component_type === 'ttt').reduce((sum, component) => sum + usageMicrousd(component.provider_cost_microusd), 0),
    gameplay: successful.filter((component) => component.component_type === 'gameplay').reduce((sum, component) => sum + usageMicrousd(component.provider_cost_microusd), 0),
    tts: successful.filter((component) => component.component_type === 'tts').reduce((sum, component) => sum + usageMicrousd(component.provider_cost_microusd), 0),
  }
  const providerTotal = costs.ttt + costs.gameplay + costs.tts
  const roundedCustomerCost = roundUsageMicrousdToCent(providerTotal)
  const maximumMicrousd = usageMicrousd(turn.maximum_microusd)
  const billedMicrousd = account.ownerQa ? 0 : Math.min(roundedCustomerCost, maximumMicrousd)
  const allocations = allocateBilled(billedMicrousd, costs)
  let balanceMicrousd: number | null = null
  let settlementWarning = ''

  if (!account.ownerQa) {
    if (!turn.usage_hold_id) {
      settlementWarning = 'Play turn had no active usage reservation.'
    } else {
      const { data: balanceData, error: captureError } = await account.supabase.rpc('rpgyw_capture_usage', {
        p_hold_id: turn.usage_hold_id,
        p_actual_microusd: billedMicrousd,
        p_metadata: {
          surface: 'play',
          feature: turn.kind === 'replay' ? 'tts-replay' : 'gameplay-turn',
          turn_billing_id: turnId,
          provider_total_microusd: providerTotal,
          ttt_provider_microusd: costs.ttt,
          gameplay_provider_microusd: costs.gameplay,
          tts_provider_microusd: costs.tts,
          rounded_customer_cost_microusd: roundedCustomerCost,
          maximum_deduction_microusd: maximumMicrousd,
          billed_microusd: billedMicrousd,
        },
      })
      if (captureError) settlementWarning = captureError.message
      else balanceMicrousd = usageMicrousd(balanceData)
    }
  }

  if (settlementWarning) {
    await admin.from('play_turn_billing').update({
      status: 'error',
      settlement_warning: settlementWarning,
      ttt_provider_microusd: costs.ttt,
      gameplay_provider_microusd: costs.gameplay,
      tts_provider_microusd: costs.tts,
      provider_total_microusd: providerTotal,
      updated_at: new Date().toISOString(),
    }).eq('id', turnId).eq('user_id', account.userId)
    return { settled: false, pending: false, billedMicrousd: 0, balanceMicrousd, ownerQaExempt: account.ownerQa, settlementWarning }
  }

  const now = new Date().toISOString()
  const { error: updateError } = await admin.from('play_turn_billing').update({
    status: 'settled',
    ttt_provider_microusd: costs.ttt,
    gameplay_provider_microusd: costs.gameplay,
    tts_provider_microusd: costs.tts,
    provider_total_microusd: providerTotal,
    billed_microusd: billedMicrousd,
    ttt_billed_microusd: allocations.ttt,
    gameplay_billed_microusd: allocations.gameplay,
    tts_billed_microusd: allocations.tts,
    balance_after_microusd: balanceMicrousd,
    settlement_warning: null,
    settled_at: now,
    updated_at: now,
  }).eq('id', turnId).eq('user_id', account.userId).neq('status', 'settled')
  if (updateError) throw new Error(`Play turn settlement could not be saved: ${updateError.message}`)

  await updateEventAllocations(account, turnId, components, allocations)
  return { settled: true, pending: false, billedMicrousd, balanceMicrousd, ownerQaExempt: account.ownerQa, settlementWarning: null }
}

export async function markAudioComplete(
  account: UsageAccount,
  turnId: string,
  expectedTtsComponents: number,
) {
  const turn = await turnFor(account, turnId)
  const expected = Math.max(0, Math.min(200, Math.trunc(expectedTtsComponents || 0)))
  const admin = createAdminClient()
  const { error } = await admin.from('play_turn_billing').update({
    audio_complete_requested: true,
    expected_tts_components: Math.max(Number(turn.expected_tts_components || 0), expected),
    updated_at: new Date().toISOString(),
  }).eq('id', turnId).eq('user_id', account.userId)
  if (error) throw new Error(`Play turn audio completion could not be recorded: ${error.message}`)
  return maybeSettlePlayTurn(account, turnId)
}
