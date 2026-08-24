import { createHash } from 'node:crypto'
import { NextRequest } from 'next/server'
import { shapeEmailAllowed } from '@/lib/shape/access'
import { selectedShapeModel } from '@/lib/shape/config'
import {
  SHAPE_MAX_INPUT_CHARACTERS,
  SHAPE_SINGLE_PASS_CHARACTERS,
  buildShapeAnalysisChunks,
  buildShapeTranscriptChunks,
  normalizeShapeTranscriptForFingerprint,
} from '@/lib/shape/transcript'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DESCRIPTION_LEVELS = new Set(['plain', 'light', 'rich', 'purple'])

function serializeJob(row: Record<string, unknown>, includeResult = false) {
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
    output_tokens: row.output_tokens || 0,
    request_count: row.request_count || 0,
    result_text: includeResult ? row.result_text : undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

async function authenticatedClient(requireBeta = true) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return { error: Response.json({ error: 'Sign in before using Shape.' }, { status: 401 }) }
  if (requireBeta && !shapeEmailAllowed(data.user.email)) return { error: Response.json({ error: 'Shape processing is still limited to the private test list.' }, { status: 403 }) }
  return { supabase, user: data.user }
}

export async function GET(request: NextRequest) {
  const auth = await authenticatedClient(true)
  if ('error' in auth) return auth.error
  const activeOnly = request.nextUrl.searchParams.get('active') === '1'

  let query = auth.supabase
    .from('shape_jobs')
    .select('id,title,description_level,transcript_characters,status,phase,analysis_total,writing_total,next_analysis_chunk_index,next_chunk_index,prompt_version,model,project_id,project_part_number,error_message,input_tokens,cached_input_tokens,output_tokens,request_count,result_text,created_at,updated_at')
    .eq('user_id', auth.user.id)
    .order('updated_at', { ascending: false })
    .limit(1)

  query = activeOnly
    ? query.in('status', ['processing', 'error'])
    : query.in('status', ['processing', 'error', 'completed'])
  const { data, error } = await query.maybeSingle()
  if (error) return Response.json({ error: 'Shape could not read your saved jobs. Confirm both Shape database migrations have been applied.' }, { status: 503 })
  return Response.json({ job: data ? serializeJob(data as Record<string, unknown>, data.status === 'completed') : null }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const auth = await authenticatedClient(true)
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
  try { body = await request.json() } catch { return Response.json({ error: 'Shape could not read that job request.' }, { status: 400 }) }

  const transcript = typeof body.transcript === 'string' ? normalizeShapeTranscriptForFingerprint(body.transcript) : ''
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 120) : 'Untitled adventure'
  const descriptionLevel = typeof body.description_level === 'string' && DESCRIPTION_LEVELS.has(body.description_level) ? body.description_level : ''
  const projectMode = body.project_mode === true
  const requestedProjectId = typeof body.project_id === 'string' ? body.project_id.trim() : ''
  const requestedProjectTitle = typeof body.project_title === 'string' ? body.project_title.trim().slice(0, 120) : ''
  const confirmDuplicate = body.confirm_duplicate === true

  if (!descriptionLevel) return Response.json({ error: 'Choose how much description Shape should add.' }, { status: 400 })
  if (transcript.length < 250) return Response.json({ error: 'Give Shape at least 250 characters of gameplay transcript.' }, { status: 400 })
  if (transcript.length > SHAPE_MAX_INPUT_CHARACTERS) return Response.json({ error: 'This transcript is too large for one Shape request. Divide it at a natural story break and use campaign-project mode to carry continuity forward.' }, { status: 400 })

  const { data: active } = await auth.supabase
    .from('shape_jobs')
    .select('id,title,status')
    .eq('user_id', auth.user.id)
    .in('status', ['processing', 'error'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (active) return Response.json({ error: `Finish or resume “${active.title}” before starting another Shape job.`, active_job_id: active.id }, { status: 409 })

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
      error: 'This account has already Shaped this exact transcript. Running it again spends API usage and may introduce different inconsistencies.',
      duplicate: true,
      duplicate_job_id: duplicate.id,
    }, { status: 409 })
  }

  let projectId: string | null = null
  let projectPartNumber = 1
  let priorContinuity = ''

  if (projectMode) {
    if (requestedProjectId) {
      const { data: project, error: projectError } = await auth.supabase
        .from('shape_projects')
        .select('id,title,continuity,completed_parts')
        .eq('id', requestedProjectId)
        .eq('user_id', auth.user.id)
        .single()
      if (projectError || !project) return Response.json({ error: 'Shape could not find that campaign project.' }, { status: 404 })
      projectId = project.id
      projectPartNumber = (project.completed_parts || 0) + 1
      priorContinuity = project.continuity || ''
    } else {
      const { data: project, error: projectError } = await auth.supabase
        .from('shape_projects')
        .insert({ user_id: auth.user.id, title: requestedProjectTitle || title || 'My Shape Project', continuity: '', completed_parts: 0 })
        .select('id,title,continuity,completed_parts')
        .single()
      if (projectError || !project) return Response.json({ error: 'Shape could not create the campaign project. Apply the Shape beta instrumentation migration first.' }, { status: 503 })
      projectId = project.id
    }
  }

  let analysisTotal = 0
  let writingTotal = 1
  try {
    if (projectMode || transcript.length > SHAPE_SINGLE_PASS_CHARACTERS) {
      analysisTotal = buildShapeAnalysisChunks(transcript).length
      writingTotal = buildShapeTranscriptChunks(transcript).length
    }
  } catch (caught) {
    return Response.json({ error: caught instanceof Error ? caught.message : 'Shape could not safely divide this transcript.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const model = selectedShapeModel()
  const { data, error } = await auth.supabase
    .from('shape_jobs')
    .insert({
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
      output_tokens: 0,
      request_count: 0,
      model,
      project_id: projectId,
      project_part_number: projectPartNumber,
      error_message: null,
      updated_at: now,
    })
    .select('id,title,description_level,transcript_characters,status,phase,analysis_total,writing_total,next_analysis_chunk_index,next_chunk_index,prompt_version,model,project_id,project_part_number,error_message,input_tokens,cached_input_tokens,output_tokens,request_count,created_at,updated_at')
    .single()

  if (error || !data) return Response.json({ error: 'Shape could not save the job. Confirm both Shape database migrations have been applied.' }, { status: 503 })
  return Response.json({ job: serializeJob(data as Record<string, unknown>) }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}


export async function DELETE(request: NextRequest) {
  const auth = await authenticatedClient(true)
  if ('error' in auth) return auth.error
  const id = request.nextUrl.searchParams.get('id')?.trim() || ''
  if (!id) return Response.json({ error: 'Choose a Shape job to discard.' }, { status: 400 })

  const { data, error } = await auth.supabase
    .from('shape_jobs')
    .update({ status: 'cancelled', phase: 'cancelled', error_message: null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .neq('status', 'completed')
    .select('id')
    .maybeSingle()

  if (error) return Response.json({ error: 'Shape could not discard that saved job.' }, { status: 500 })
  if (!data) return Response.json({ error: 'That Shape job is already complete or could not be found.' }, { status: 409 })
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
