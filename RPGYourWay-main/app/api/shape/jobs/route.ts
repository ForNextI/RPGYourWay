import { createHash, randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { estimateShapeMaximumMicrousd } from '@/lib/shape/billing'
import { selectedShapeModel } from '@/lib/shape/config'
import { settleShapeJobUsage } from '@/lib/shape/settlement'
import {
  SHAPE_MAX_INPUT_CHARACTERS,
  SHAPE_SINGLE_PASS_CHARACTERS,
  buildShapeAnalysisChunks,
  buildShapeTranscriptChunks,
  normalizeShapeTranscriptForFingerprint,
} from '@/lib/shape/transcript'
import { createClient } from '@/lib/supabase/server'
import { formatUsageDollars } from '@/lib/usage/money'
import { isOwnerQaEmail } from '@/lib/usage/owner-qa'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DESCRIPTION_LEVELS = new Set(['plain', 'light', 'rich', 'purple'])
const SHAPE_HOLD_DAYS = 30

function serializeJob(row: Record<string, unknown>, includeResult = false, includePartial = false) {
  return {
    id: row.id,
    title: row.title,
    description_level: row.description_level,
    transcript_characters: row.transcript_characters,
    status: row.status,
    phase: row.phase,
    analysis_total: row.analysis_total,
    writing_total: row.writing_total,
    next_analysis_chunk_index: row.next_analysis_chunk_index,
    next_chunk_index: row.next_chunk_index,
    prompt_version: row.prompt_version,
    model: row.model,
    project_id: row.project_id,
    project_part_number: row.project_part_number || 1,
    error_message: row.error_message,
    input_tokens: row.input_tokens || 0,
    cached_input_tokens: row.cached_input_tokens || 0,
    cache_write_tokens: row.cache_write_tokens || 0,
    output_tokens: row.output_tokens || 0,
    request_count: row.request_count || 0,
    maximum_deduction_microusd: row.maximum_deduction_microusd || 0,
    provider_cost_microusd: row.provider_cost_microusd || 0,
    billed_microusd: row.billed_microusd || 0,
    result_text: includeResult ? row.result_text : undefined,
    partial_result_text: includePartial && typeof row.prose_text === 'string' && row.prose_text ? row.prose_text : undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

async function authenticatedClient() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return { error: Response.json({ error: 'Sign in before using Script.' }, { status: 401 }) }
  return { supabase, user: data.user, ownerQa: isOwnerQaEmail(data.user.email) }
}

const JOB_SELECT = 'id,title,description_level,transcript_characters,status,phase,analysis_total,writing_total,next_analysis_chunk_index,next_chunk_index,prompt_version,model,project_id,project_part_number,error_message,input_tokens,cached_input_tokens,cache_write_tokens,output_tokens,request_count,maximum_deduction_microusd,provider_cost_microusd,billed_microusd,result_text,prose_text,created_at,updated_at'

export async function GET(request: NextRequest) {
  const auth = await authenticatedClient()
  if ('error' in auth) return auth.error
  const activeOnly = request.nextUrl.searchParams.get('active') === '1'

  let query = auth.supabase
    .from('shape_jobs')
    .select(JOB_SELECT)
    .eq('user_id', auth.user.id)
    .order('updated_at', { ascending: false })
    .limit(1)

  query = activeOnly
    ? query.in('status', ['processing', 'error'])
    : query.in('status', ['processing', 'error', 'completed'])
  const { data, error } = await query.maybeSingle()
  if (error) return Response.json({ error: 'Script could not read your saved jobs. Confirm the Script database foundation has been applied.' }, { status: 503 })
  return Response.json({ job: data ? serializeJob(data as Record<string, unknown>, data.status === 'completed', data.status === 'error') : null }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const auth = await authenticatedClient()
  if ('error' in auth) return auth.error

  let body: {
    title?: unknown
    transcript?: unknown
    description_level?: unknown
    project_mode?: unknown
    project_id?: unknown
    project_title?: unknown
    confirm_duplicate?: unknown
  }
  try { body = await request.json() } catch { return Response.json({ error: 'Script could not read that job request.' }, { status: 400 }) }

  const transcript = typeof body.transcript === 'string' ? normalizeShapeTranscriptForFingerprint(body.transcript) : ''
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 120) : 'Untitled adventure'
  const descriptionLevel = typeof body.description_level === 'string' && DESCRIPTION_LEVELS.has(body.description_level) ? body.description_level : ''
  const projectMode = body.project_mode === true
  const requestedProjectId = typeof body.project_id === 'string' ? body.project_id.trim() : ''
  const requestedProjectTitle = typeof body.project_title === 'string' ? body.project_title.trim().slice(0, 120) : ''
  const confirmDuplicate = body.confirm_duplicate === true

  if (!descriptionLevel) return Response.json({ error: 'Choose how much description Script should add.' }, { status: 400 })
  if (transcript.length < 250) return Response.json({ error: 'Give Script at least 250 characters of gameplay transcript.' }, { status: 400 })
  if (transcript.length > SHAPE_MAX_INPUT_CHARACTERS) return Response.json({ error: 'This transcript is too large for one Script request. Divide it at a natural story break and use campaign-project mode to carry continuity forward.' }, { status: 400 })

  const { data: active } = await auth.supabase
    .from('shape_jobs')
    .select('id,title,status')
    .eq('user_id', auth.user.id)
    .in('status', ['processing', 'error'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (active) return Response.json({ error: `Finish or resume “${active.title}” before starting another Script job.`, active_job_id: active.id }, { status: 409 })

  const fingerprint = createHash('sha256').update(transcript).digest('hex')
  if (!confirmDuplicate) {
    const { data: duplicate } = await auth.supabase
      .from('shape_jobs')
      .select('id,title,completed_at')
      .eq('user_id', auth.user.id)
      .eq('fingerprint', fingerprint)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (duplicate) return Response.json({
      error: 'This account has already Scripted this exact transcript. Running it again spends usage and may introduce different inconsistencies.',
      duplicate: true,
      duplicate_job_id: duplicate.id,
    }, { status: 409 })
  }

  let analysisTotal = 0
  let writingTotal = 1
  let maximumDeductionMicrousd = 0
  try {
    if (projectMode || transcript.length > SHAPE_SINGLE_PASS_CHARACTERS) {
      analysisTotal = buildShapeAnalysisChunks(transcript).length
      writingTotal = buildShapeTranscriptChunks(transcript).length
    }
    maximumDeductionMicrousd = estimateShapeMaximumMicrousd(transcript, projectMode)
  } catch (caught) {
    return Response.json({ error: caught instanceof Error ? caught.message : 'Script could not safely divide or estimate this transcript.' }, { status: 400 })
  }

  let projectId: string | null = null
  let projectPartNumber = 1
  let priorContinuity = ''
  if (projectMode && requestedProjectId) {
    const { data: project, error: projectError } = await auth.supabase
      .from('shape_projects')
      .select('id,title,continuity,completed_parts')
      .eq('id', requestedProjectId)
      .eq('user_id', auth.user.id)
      .single()
    if (projectError || !project) return Response.json({ error: 'Script could not find that campaign project.' }, { status: 404 })
    projectId = project.id
    projectPartNumber = (project.completed_parts || 0) + 1
    priorContinuity = project.continuity || ''
  }

  const jobId = randomUUID()
  let holdId: string | null = null
  if (!auth.ownerQa) {
    const holdExpiry = new Date(Date.now() + SHAPE_HOLD_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const holdResult = await auth.supabase.rpc('rpgyw_reserve_usage', {
      p_maximum_microusd: maximumDeductionMicrousd,
      p_source: 'shape',
      p_source_ref: jobId,
      p_idempotency_key: `shape:job:${jobId}`,
      p_expires_at: holdExpiry,
    })
    holdId = typeof holdResult.data === 'string' ? holdResult.data : null
    if (holdResult.error || !holdId) {
      const insufficient = /insufficient rpg your way usage balance/i.test(holdResult.error?.message || '')
      return Response.json({
        error: insufficient
          ? `This Script request can reserve up to ${formatUsageDollars(maximumDeductionMicrousd)}, but your available balance is lower. Add usage in Account and try again.`
          : `Script could not reserve the maximum estimated deduction: ${holdResult.error?.message || 'unknown balance error'}`,
        insufficient_balance: insufficient,
        maximum_microusd: maximumDeductionMicrousd,
        maximum_display: formatUsageDollars(maximumDeductionMicrousd),
      }, { status: insufficient ? 402 : 503 })
    }
  }

  let createdProjectId: string | null = null
  if (projectMode && !requestedProjectId) {
    const { data: project, error: projectError } = await auth.supabase
      .from('shape_projects')
      .insert({ user_id: auth.user.id, title: requestedProjectTitle || title || 'My Script Project', continuity: '', completed_parts: 0 })
      .select('id,title,continuity,completed_parts')
      .single()
    if (projectError || !project) {
      holdId ? await auth.supabase.rpc('rpgyw_release_usage', { p_hold_id: holdId }) : undefined
      return Response.json({ error: 'Script could not create the campaign project. Apply the Script database foundation first.' }, { status: 503 })
    }
    projectId = project.id
    createdProjectId = project.id
  }

  const now = new Date().toISOString()
  const model = selectedShapeModel()
  const { data, error } = await auth.supabase
    .from('shape_jobs')
    .insert({
      id: jobId,
      user_id: auth.user.id,
      title,
      description_level: descriptionLevel,
      transcript,
      transcript_characters: transcript.length,
      fingerprint,
      status: 'processing',
      phase: analysisTotal > 0 ? 'analysis' : 'writing',
      analysis_total: analysisTotal,
      writing_total: writingTotal,
      next_analysis_chunk_index: 0,
      next_chunk_index: 0,
      continuity: '',
      prior_continuity: priorContinuity,
      prose_text: '',
      input_tokens: 0,
      cached_input_tokens: 0,
      cache_write_tokens: 0,
      output_tokens: 0,
      request_count: 0,
      model,
      project_id: projectId,
      project_part_number: projectPartNumber,
      usage_hold_id: holdId,
      maximum_deduction_microusd: maximumDeductionMicrousd,
      provider_cost_microusd: 0,
      billed_microusd: 0,
      error_message: null,
      updated_at: now,
    })
    .select(JOB_SELECT)
    .single()

  if (error || !data) {
    holdId ? await auth.supabase.rpc('rpgyw_release_usage', { p_hold_id: holdId }) : undefined
    if (createdProjectId) await auth.supabase.from('shape_projects').delete().eq('id', createdProjectId).eq('user_id', auth.user.id)
    return Response.json({ error: 'Script could not save the job. Confirm the Script commercial-billing database migration has been applied.' }, { status: 503 })
  }
  return Response.json({ job: serializeJob(data as Record<string, unknown>) }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticatedClient()
  if ('error' in auth) return auth.error
  const id = request.nextUrl.searchParams.get('id')?.trim() || ''
  if (!id) return Response.json({ error: 'Choose a Script job to discard.' }, { status: 400 })

  const { data: existing, error: findError } = await auth.supabase
    .from('shape_jobs')
    .select('id,status,usage_hold_id,maximum_deduction_microusd,provider_cost_microusd,billed_microusd')
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .maybeSingle()
  if (findError) return Response.json({ error: 'Script could not read that saved job.' }, { status: 500 })
  if (!existing || existing.status === 'completed') return Response.json({ error: 'That Script job is already complete or could not be found.' }, { status: 409 })

  try {
    await settleShapeJobUsage(auth.supabase, existing)
  } catch (caught) {
    return Response.json({ error: caught instanceof Error ? caught.message : 'Script could not settle completed usage before discarding the job.' }, { status: 500 })
  }

  const { data, error } = await auth.supabase
    .from('shape_jobs')
    .update({ status: 'cancelled', phase: 'cancelled', error_message: null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .neq('status', 'completed')
    .select('id')
    .maybeSingle()

  if (error) return Response.json({ error: 'Script could not discard that saved job.' }, { status: 500 })
  if (!data) return Response.json({ error: 'That Script job is already complete or could not be found.' }, { status: 409 })
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
