import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData.user
  if (userError || !user) return Response.json({ error: 'Sign in before using Script.' }, { status: 401 })

  const jobId = request.nextUrl.searchParams.get('job_id')?.trim() || ''
  if (!jobId) return Response.json({ error: 'Choose a Script job first.' }, { status: 400 })

  const { data: job, error: jobError } = await supabase
    .from('shape_jobs')
    .select('id,title,project_id,project_part_number,transcript_characters,status,prompt_version,model,input_tokens,cached_input_tokens,cache_write_tokens,output_tokens,request_count,maximum_deduction_microusd,provider_cost_microusd,billed_microusd,created_at,updated_at,completed_at')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single()

  if (jobError || !job) return Response.json({ error: 'Script could not find that job.' }, { status: 404 })

  const { data: events, error: eventError } = await supabase
    .from('shape_usage_events')
    .select('phase,operation,model,provider_request_id,input_tokens,cached_input_tokens,cache_write_tokens,output_tokens,total_tokens,input_characters,duration_ms,success,status_code,created_at')
    .eq('job_id', jobId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (eventError) return Response.json({ error: 'Script could not read the usage ledger.' }, { status: 503 })

  return Response.json({
    generated_at: new Date().toISOString(),
    purpose: 'RPG Your Way Script usage report. No transcript or finished prose is included.',
    job,
    events: events || [],
  }, { headers: { 'Cache-Control': 'no-store' } })
}
