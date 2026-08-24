import { createHash } from 'node:crypto'
import { NextRequest } from 'next/server'
import { shapeEmailAllowed } from '@/lib/shape/access'
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
    error_message: row.error_message,
    input_tokens: row.input_tokens || 0,
    output_tokens: row.output_tokens || 0,
    result_text: includeResult ? row.result_text : undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

async function authenticatedClient() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return { error: Response.json({ error: 'Sign in before using Shape.' }, { status: 401 }) }
  if (!shapeEmailAllowed(data.user.email)) return { error: Response.json({ error: 'Shape processing is still limited to the private test list.' }, { status: 403 }) }
  return { supabase, user: data.user }
}

export async function GET(request: NextRequest) {
  const auth = await authenticatedClient()
  if ('error' in auth) return auth.error
  const activeOnly = request.nextUrl.searchParams.get('active') === '1'

  let query = auth.supabase
    .from('shape_jobs')
    .select('id,title,description_level,transcript_characters,status,phase,analysis_total,writing_total,next_analysis_chunk_index,next_chunk_index,prompt_version,error_message,input_tokens,output_tokens,result_text,created_at,updated_at')
    .eq('user_id', auth.user.id)
    .order('updated_at', { ascending: false })
    .limit(1)

  if (activeOnly) query = query.in('status', ['processing', 'error'])
  const { data, error } = await query.maybeSingle()
  if (error) return Response.json({ error: 'Shape could not read your saved jobs. Confirm the Shape database migration has been applied.' }, { status: 503 })
  return Response.json({ job: data ? serializeJob(data as Record<string, unknown>, data.status === 'completed') : null }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const auth = await authenticatedClient()
  if ('error' in auth) return auth.error

  let body: { title?: unknown; transcript?: unknown; description_level?: unknown }
  try { body = await request.json() } catch { return Response.json({ error: 'Shape could not read that job request.' }, { status: 400 }) }

  const transcript = typeof body.transcript === 'string' ? normalizeShapeTranscriptForFingerprint(body.transcript) : ''
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 120) : 'Untitled adventure'
  const descriptionLevel = typeof body.description_level === 'string' && DESCRIPTION_LEVELS.has(body.description_level) ? body.description_level : ''

  if (!descriptionLevel) return Response.json({ error: 'Choose how much description Shape should add.' }, { status: 400 })
  if (transcript.length < 250) return Response.json({ error: 'Give Shape at least 250 characters of gameplay transcript.' }, { status: 400 })
  if (transcript.length > SHAPE_MAX_INPUT_CHARACTERS) return Response.json({ error: 'This transcript is too large for one Shape request. Divide it at a natural story break.' }, { status: 400 })

  let analysisTotal = 0
  let writingTotal = 1
  try {
    if (transcript.length > SHAPE_SINGLE_PASS_CHARACTERS) {
      analysisTotal = buildShapeAnalysisChunks(transcript).length
      writingTotal = buildShapeTranscriptChunks(transcript).length
    }
  } catch (caught) {
    return Response.json({ error: caught instanceof Error ? caught.message : 'Shape could not safely divide this transcript.' }, { status: 400 })
  }

  const fingerprint = createHash('sha256').update(transcript).digest('hex')
  const now = new Date().toISOString()
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
      prose_text: '',
      input_tokens: 0,
      output_tokens: 0,
      error_message: null,
      updated_at: now,
    })
    .select('id,title,description_level,transcript_characters,status,phase,analysis_total,writing_total,next_analysis_chunk_index,next_chunk_index,prompt_version,error_message,input_tokens,output_tokens,created_at,updated_at')
    .single()

  if (error || !data) return Response.json({ error: 'Shape could not save the job. Apply the included Supabase Shape migration first.' }, { status: 503 })
  return Response.json({ job: serializeJob(data as Record<string, unknown>) }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
