import { createClient } from '@/lib/supabase/server'
import { terraCostMicrousd } from '@/lib/usage/openai-cost'

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

type BillableShapeJob = {
  id: string
  usage_hold_id?: string | null
  maximum_deduction_microusd?: number | null
  provider_cost_microusd?: number | null
  billed_microusd?: number | null
}

export async function shapeProviderCostMicrousd(supabase: ServerSupabase, jobId: string) {
  const { data, error } = await supabase
    .from('shape_usage_events')
    .select('model,input_tokens,cached_input_tokens,cache_write_tokens,output_tokens,success')
    .eq('job_id', jobId)

  if (error || !data) throw new Error('Script could not calculate the completed provider usage.')

  let total = 0
  for (const event of data as Array<Record<string, unknown>>) {
    if (!event.success) continue
    const model = typeof event.model === 'string' ? event.model : ''
    if (!model.includes('gpt-5.6-terra')) throw new Error(`Script cannot bill an unrecognized model safely: ${model || 'unknown model'}.`)
    total += terraCostMicrousd({
      inputTokens: Number(event.input_tokens || 0),
      cachedInputTokens: Number(event.cached_input_tokens || 0),
      cacheWriteTokens: Number(event.cache_write_tokens || 0),
      outputTokens: Number(event.output_tokens || 0),
    })
  }
  return total
}

export async function settleShapeJobUsage(supabase: ServerSupabase, job: BillableShapeJob) {
  const providerCostMicrousd = await shapeProviderCostMicrousd(supabase, job.id)
  const maximumMicrousd = Math.max(0, Number(job.maximum_deduction_microusd || 0))
  const holdId = typeof job.usage_hold_id === 'string' ? job.usage_hold_id : ''

  // Jobs created before the commercial billing release had no reservation and remain
  // historical/private-test jobs. New public jobs always have both values.
  if (!holdId || maximumMicrousd <= 0) {
    return { providerCostMicrousd, billedMicrousd: 0, legacyNoCharge: true as const }
  }

  const billedMicrousd = Math.min(providerCostMicrousd, maximumMicrousd)
  const { data, error } = await supabase.rpc('rpgyw_capture_usage', {
    p_hold_id: holdId,
    p_actual_microusd: billedMicrousd,
    p_metadata: {
      shape_job_id: job.id,
      provider_cost_microusd: providerCostMicrousd,
      maximum_deduction_microusd: maximumMicrousd,
      billed_microusd: billedMicrousd,
      capped_at_maximum: providerCostMicrousd > maximumMicrousd,
    },
  })
  if (error) throw new Error(`Script could not settle the usage reservation: ${error.message}`)

  const { error: updateError } = await supabase
    .from('shape_jobs')
    .update({ provider_cost_microusd: providerCostMicrousd, billed_microusd: billedMicrousd, updated_at: new Date().toISOString() })
    .eq('id', job.id)
  if (updateError) console.error('Script settled usage but could not save the billing summary.', updateError.message)

  return { providerCostMicrousd, billedMicrousd, balanceMicrousd: data, legacyNoCharge: false as const }
}
