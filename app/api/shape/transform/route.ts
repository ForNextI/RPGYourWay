import { SHAPE_PROMPT_VERSION, selectedShapeModel } from '@/lib/shape/config'
import { settleShapeJobUsage } from '@/lib/shape/settlement'
import {
  SHAPE_SINGLE_PASS_CHARACTERS,
  buildShapeAnalysisChunks,
  buildShapeRecoverySubchunks,
  buildShapeTranscriptChunks,
  provisionalProseTail,
  reconcileShapeWritingSection,
  type ShapeWritingDisposition,
} from '@/lib/shape/transcript'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_CONTINUITY_CHARACTERS = 20_000
const MAX_REVISED_PREVIOUS_PROSE_CHARACTERS = 14_000

const ANALYSIS_PROMPT = `You are ProseMaker's continuity editor. Read this chronological section of a raw tabletop roleplaying transcript and update the continuity ledger before any story prose is written. Do not write story prose yet.

Build and maintain a compact continuity ledger that the prose writer can use for every section. Record only story-bearing facts: character names, identities, pronouns, appearances, relationships, locations, chronology, possessions, injuries, conditions, discoveries, goals, unresolved threads, important dialogue or promises, and corrections. Ignore dice arithmetic, menus, rules administration, repeated narration, abandoned declarations, talk-to-text debris, and irrelevant out-of-character conversation.

TIME SCOPE IS CRITICAL. Do not flatten the campaign into its final state. Use these canon rules:
- RETROACTIVE CORRECTION: an earlier transcript statement was wrong and a player or Game Master explicitly corrects it. State what earlier fact is superseded and how far backward the correction applies. A corrected NPC name replaces the mistaken name from the original introduction when that is clearly the intended scope. Continued play using the replacement is sufficient confirmation; do not require a formal approval phrase.
- SUPERSEDED ACTION: when a player changes or retracts a declared action before it is finally resolved, the corrected declaration wins. Remove the abandoned action even if the Game Master had already begun narrating it. Preserve only the action the transcript ultimately treats as having happened and its consequences.
- REVELATION OR DISCOVERY: a fact may have been true earlier, but the characters or narrator did not know it yet. Preserve the earlier viewpoint and apply the knowledge only from the discovery point forward.
- FORWARD CHANGE: a name, title, relationship, allegiance, injury, possession, location, condition, identity choice, or other state changes during play. Preserve the old state before the effective point and the new state afterward. A later spelling or pronunciation correction to a newly chosen name may correct that choice from the moment the choice was made, but it must not rename the character in scenes before the choice.
- FIRST-ESTABLISHED FACT DEFAULT: if the transcript later contradicts an already established minor fact without an explicit correction or an in-story change, treat the earliest clear version as canon and the later isolated contradiction as accidental drift. Later repetition of the original fact strengthens that conclusion. Do not invent a disguise, transformation, hidden explanation, or retcon to reconcile ordinary drift.
Never turn a development into a retcon merely because it appears later in the transcript.

When ROLLING CONTINUITY is supplied, it is the compact record from earlier analysis sections of this same submission. Merge it with the current transcript section into one updated, timeline-aware ledger. When the current section truly corrects an earlier section, preserve the correction with its retroactive scope. When it merely reveals or changes something, preserve the earlier state and the effective transition point. When it merely drifts from a previously established minor fact, preserve the first-established fact unless later text explicitly corrects it or depicts a real change.

When PRIOR PROJECT CONTINUITY is supplied, it comes from earlier completed Shape project parts. Carry it forward using the same rules. If a later part explicitly corrects an earlier-project fact, record the corrected canon and its scope in the continuity ledger. Do not create customer-facing editing homework.

When no rolling continuity is supplied, begin the ledger from the current transcript section. Process sections strictly in chronological order. The final ledger after the last section must represent the complete submitted transcript while preserving when facts became true, known, or superseded.

Return only valid JSON with this exact shape:
{"continuity":"compact timeline-aware continuity ledger","retcon_notices":[]}
The retcon_notices field exists only for compatibility and must always be an empty array. Resolve ordinary contradictions with the rules above and record any genuinely uncertain material neutrally inside the continuity ledger rather than producing a human-review notice.`

const SINGLE_PASS_PROMPT = `You are ProseMaker, a one-shot converter that turns a raw tabletop roleplaying transcript into finished third-person, past-tense fantasy prose. Read the entire transcript before writing and determine what actually happened. Respect chronology when resolving later information. An explicit player or Game Master correction can retroactively replace an earlier mistake, including a mistaken NPC name. Continued play with the replacement is enough confirmation. If a player changes or retracts an action before it is finally resolved, use only the corrected action even when the Game Master had already begun narrating the abandoned version. A later discovery, injury, relationship change, possession change, title, allegiance, or chosen name is a forward change and does not rewrite earlier scenes. If a character adopts a new name midway through the story, use the old name before that choice and the new name afterward; a later spelling correction to the chosen name may repair it from the moment of choice without reaching farther back. When a later isolated detail contradicts an earlier established minor fact without an explicit correction or in-story change, keep the first-established fact and treat the later contradiction as drift. Omit abandoned actions, dice arithmetic, menus, rules discussion, game administration, talk-to-text errors, repeated narration, and irrelevant out-of-character conversation. Tell each event once.

Preserve player choices, sequence, identities, locations, injuries, actions, consequences, important dialogue, humor, tactics, spells, abilities, and established facts. Combine a player's declared action and the Game Master's result into one complete fictional event. Use maximum reasonable inference and minimum invention: fill only obvious connective gaps, and never invent unsupported events, motives, private thoughts, dialogue, discoveries, outcomes, or conclusions. You may add non-eventful sensory texture that naturally fits an already established place, action, or mood, but it must not change what happened.

Build paragraphs around complete dramatic beats. Group related movement, observation, dialogue, reaction, and consequence into coherent paragraphs instead of restating each transcript line as a separate paragraph. Vary sentence length, use natural transitions, preserve distinctive speech, and favor specific source details over stock fantasy language.

Check names, speakers, pronouns, locations, injuries, and actions before finalizing. Avoid commentary, headings, prefaces, markdown, repetitive dramatic button sentences, manufactured endings, and false cliffhangers. Preserve a real ending when one exists; otherwise stop where the source stops. Output only the finished prose.`

const WRITING_PROMPT = `You are ProseMaker, a rolling converter that turns raw tabletop roleplaying transcripts into finished third-person, past-tense fantasy prose.

The complete current transcript was analyzed before writing began. The CONTINUITY LEDGER below is timeline-aware. Follow it without erasing chronology. At each moment in the story, use the name, knowledge, relationship, possessions, injuries, conditions, and other state that were actually in force at that point. Apply a later fact backward only when the ledger identifies it as a RETROACTIVE CORRECTION. A superseded declaration is not an event: if the player changed or retracted an action before final resolution, write only the corrected action and its actual consequences. Do not apply a REVELATION or FORWARD CHANGE to earlier scenes. If a character chooses a new name midway through the story, use the old name before that choice and the new name afterward. A later correction to the spelling of that newly chosen name may repair the choice from that moment forward without reaching farther back. When the ledger identifies ordinary descriptive drift, preserve the first-established fact instead of inventing an explanation for the contradiction.

You are writing one section of a longer document with a soft seam. CONTEXT BEFORE and CONTEXT AFTER overlap neighboring source sections. PREVIOUS PROSE TAIL is deliberately provisional: it is the final several paragraphs produced by the preceding section and may be revised now that you can see the source on both sides of the seam.

Return three fields. SECTION DISPOSITION must be either prose or no_new_prose. Use prose when NEW TRANSCRIPT MATERIAL contains at least one story-bearing event that belongs in the manuscript; in that case NEW PROSE must be nonempty. Use no_new_prose only when you successfully processed the entire NEW TRANSCRIPT MATERIAL and, after applying the omission rules below, none of it belongs as new narrative prose; in that case NEW PROSE must be an empty string. A no_new_prose section is a successful processed section, not a failure. Do not use no_new_prose merely because the material is difficult, corrected, repetitive, or awkward if any story-bearing event remains. REVISED PREVIOUS PROSE TAIL must be a complete replacement for the supplied provisional tail. Preserve every real event, action, consequence, and important line already represented there, but repair repetition, false endings, awkward transitions, mistaken continuity, or a sentence that clearly belongs with the new material. If the supplied tail is empty, return an empty string. NEW PROSE must cover only NEW TRANSCRIPT MATERIAL. Do not retell CONTEXT BEFORE, and do not prematurely write CONTEXT AFTER. Together, the revised tail and new prose must create one continuous manuscript with no duplicated or missing event at the seam. Administrative-only material may therefore legitimately return no_new_prose while still revising the previous tail if a correction within the current source affects that provisional seam.

The raw transcript may repeat the same event several ways: a player declares an action, the Game Master restates it, the Game Master gives the result, and a later context-restoration message may summarize it again. Those are not four story events. Merge declaration, restatement, and outcome into one fictional beat. Ignore later source recap when the event has already been written. Before returning, compare every paragraph of NEW PROSE with the REVISED PREVIOUS PROSE TAIL and with the other paragraphs in NEW PROSE. If two passages narrate the same conversation, action, revelation, or outcome from duplicated source material, merge them and tell the event once.

Resolve player declarations and Game Master results into complete fictional events. Omit abandoned actions, dice arithmetic, menus, rules discussion, game administration, talk-to-text errors, repeated narration, and irrelevant out-of-character conversation. Tell each event once.

Preserve player choices, sequence, identities, locations, injuries, actions, consequences, important dialogue, humor, tactics, spells, abilities, and established facts. Use maximum reasonable inference and minimum invention. Fill only obvious connective gaps, and never invent unsupported events, motives, private thoughts, dialogue, discoveries, outcomes, or conclusions. Non-eventful sensory texture may be added when it fits an established place, action, or mood and does not change what happened.

Build paragraphs around complete dramatic beats. Group related movement, observation, dialogue, reaction, and consequence into coherent paragraphs. Vary sentence length, use natural transitions, preserve distinctive speech, and favor specific source details over stock fantasy language.

Check names, speakers, pronouns, locations, injuries, and actions before finalizing. Avoid commentary, summaries, headings, prefaces, markdown, manufactured endings, and false cliffhangers. For a nonfinal section, do not force its last paragraph to sound like an ending because its final paragraphs will remain provisional until the next section is written. On the final section, preserve a real ending when one exists; otherwise stop where the source stops.`

const DESCRIPTION_PROMPTS = {
  plain: 'DESCRIPTION LEVEL: PLAIN AND SIMPLE. Write clean, economical prose. Add only the description needed for clarity, place, and continuity. Keep imagery restrained and sentences direct.',
  light: 'DESCRIPTION LEVEL: SLIGHTLY DESCRIPTIVE. Add selective sensory detail, smoother transitions, and a little atmosphere. Keep the prose natural and readable rather than ornate.',
  rich: 'DESCRIPTION LEVEL: VERY DESCRIPTIVE. Use fuller sensory detail, stronger scene texture, varied sentence rhythms, and more evocative language. Remain faithful to the transcript and do not add new plot facts or player-character thoughts.',
  purple: 'DESCRIPTION LEVEL: EXCESSIVELY FLOWERY AND PURPLE. Deliberately use lavish, ornate, image-heavy prose, elaborate descriptions, and heightened metaphor. The style may be gloriously excessive, but the events, dialogue, motives, and outcomes must still remain faithful to the transcript.',
} as const

type DescriptionLevel = keyof typeof DESCRIPTION_PROMPTS

type ShapeJobRow = {
  id: string
  user_id: string
  title: string
  description_level: DescriptionLevel
  transcript: string
  transcript_characters: number
  fingerprint: string
  status: 'processing' | 'error' | 'completed' | 'cancelled'
  phase: string
  analysis_total: number
  writing_total: number
  next_analysis_chunk_index: number
  next_chunk_index: number
  continuity: string
  prior_continuity: string
  prose_text: string
  result_text: string | null
  prompt_version: string | null
  model: string | null
  project_id: string | null
  project_part_number: number
  input_tokens: number
  cached_input_tokens: number
  cache_write_tokens: number
  output_tokens: number
  request_count: number
  usage_hold_id: string | null
  maximum_deduction_microusd: number
  provider_cost_microusd: number
  billed_microusd: number
  error_message: string | null
  created_at: string
  updated_at: string
}

type OpenAiUsage = {
  input_tokens?: number
  output_tokens?: number
  total_tokens?: number
  input_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number }
}

type OpenAiPayload = {
  id?: string
  output_text?: string
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>
  usage?: OpenAiUsage
}

type UsageSummary = {
  inputTokens: number
  cachedInputTokens: number
  cacheWriteTokens: number
  outputTokens: number
  totalTokens: number
}

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

function serializeJob(row: ShapeJobRow, includeResult = false, includePartial = false) {
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
    partial_result_text: includePartial && row.prose_text ? row.prose_text : undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function outputText(payload: OpenAiPayload) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text.trim()
  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === 'output_text' && typeof item.text === 'string')
    .map((item) => item.text || '')
    .join('')
    .trim()
}

function usageSummary(payload: OpenAiPayload): UsageSummary {
  const usage = payload.usage || {}
  const inputTokens = Math.max(0, Math.floor(usage.input_tokens || 0))
  const cachedInputTokens = Math.max(0, Math.floor(usage.input_tokens_details?.cached_tokens || 0))
  const cacheWriteTokens = Math.max(0, Math.floor(usage.input_tokens_details?.cache_write_tokens || 0))
  const outputTokens = Math.max(0, Math.floor(usage.output_tokens || 0))
  return {
    inputTokens,
    cachedInputTokens,
    cacheWriteTokens,
    outputTokens,
    totalTokens: Math.max(0, Math.floor(usage.total_tokens || inputTokens + outputTokens)),
  }
}

async function recordUsageEvent(
  supabase: ServerSupabase,
  userId: string,
  job: ShapeJobRow,
  details: {
    phase: string
    operation: string
    model: string
    providerRequestId: string | null
    inputCharacters: number
    durationMs: number
    success: boolean
    statusCode: number | null
    usage: UsageSummary
  },
) {
  const { error } = await supabase.from('shape_usage_events').upsert({
    user_id: userId,
    job_id: job.id,
    project_id: job.project_id,
    phase: details.phase,
    operation: details.operation,
    model: details.model,
    provider_request_id: details.providerRequestId,
    input_tokens: details.usage.inputTokens,
    cached_input_tokens: details.usage.cachedInputTokens,
    cache_write_tokens: details.usage.cacheWriteTokens,
    output_tokens: details.usage.outputTokens,
    total_tokens: details.usage.totalTokens,
    input_characters: details.inputCharacters,
    duration_ms: details.durationMs,
    success: details.success,
    status_code: details.statusCode,
    created_at: new Date().toISOString(),
  }, { onConflict: 'job_id,operation' })
  if (error) console.error('Shape usage ledger write failed', error.message)
}

async function openAiStep(
  supabase: ServerSupabase,
  userId: string,
  job: ShapeJobRow,
  details: {
    phase: string
    operation: string
    inputCharacters: number
    system: string
    user: string
    maxOutputTokens: number
    idempotencyKey: string
    jsonSchema?: { name: string; schema: Record<string, unknown> }
  },
) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('Script is not connected to OPENAI_API_KEY.')
  const model = selectedShapeModel()
  const startedAt = Date.now()
  let statusCode: number | null = null
  let providerRequestId: string | null = null

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': details.idempotencyKey,
      },
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: 'low' },
        max_output_tokens: details.maxOutputTokens,
        input: [
          { role: 'system', content: `${SHAPE_PROMPT_VERSION}\n\n${details.system}` },
          { role: 'user', content: details.user },
        ],
        ...(details.jsonSchema ? {
          text: {
            format: {
              type: 'json_schema',
              name: details.jsonSchema.name,
              strict: true,
              schema: details.jsonSchema.schema,
            },
          },
        } : {}),
      }),
      signal: AbortSignal.timeout(115_000),
    })
    statusCode = response.status
    providerRequestId = response.headers.get('x-request-id')

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error('Shape OpenAI request failed', response.status, detail.slice(0, 1_000))
      await recordUsageEvent(supabase, userId, job, {
        phase: details.phase,
        operation: details.operation,
        model,
        providerRequestId,
        inputCharacters: details.inputCharacters,
        durationMs: Date.now() - startedAt,
        success: false,
        statusCode,
        usage: { inputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0, totalTokens: 0 },
      })
      throw new Error(`Provider returned HTTP ${response.status} during ${details.operation}.`)
    }

    const payload = await response.json() as OpenAiPayload
    providerRequestId = providerRequestId || payload.id || null
    const usage = usageSummary(payload)
    await recordUsageEvent(supabase, userId, job, {
      phase: details.phase,
      operation: details.operation,
      model,
      providerRequestId,
      inputCharacters: details.inputCharacters,
      durationMs: Date.now() - startedAt,
      success: true,
      statusCode,
      usage,
    })
    return { payload, usage, model }
  } catch (caught) {
    if (caught instanceof Error && caught.message.startsWith('Provider returned HTTP ')) throw caught
    await recordUsageEvent(supabase, userId, job, {
      phase: details.phase,
      operation: details.operation,
      model,
      providerRequestId,
      inputCharacters: details.inputCharacters,
      durationMs: Date.now() - startedAt,
      success: false,
      statusCode,
      usage: { inputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0, totalTokens: 0 },
    })
    const reason = caught instanceof Error ? caught.message : String(caught)
    const timeout = caught instanceof Error && (caught.name === 'TimeoutError' || caught.name === 'AbortError')
    throw new Error(timeout ? `Provider timeout during ${details.operation}.` : `Provider request failed during ${details.operation}: ${reason}`)
  }
}

function parseContinuity(raw: string) {
  const unfenced = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try {
    const parsed = JSON.parse(unfenced) as { continuity?: unknown }
    if (typeof parsed.continuity === 'string' && parsed.continuity.trim()) return parsed.continuity.trim().slice(0, MAX_CONTINUITY_CHARACTERS)
  } catch {}
  return unfenced.slice(0, MAX_CONTINUITY_CHARACTERS) || 'No additional continuity ledger was produced.'
}

function parseRolling(raw: string): { section_disposition: ShapeWritingDisposition; revised_previous_tail: string; new_prose: string } {
  const unfenced = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const parsed = JSON.parse(unfenced) as { section_disposition?: unknown; revised_previous_tail?: unknown; new_prose?: unknown }
  if (parsed.section_disposition !== 'prose' && parsed.section_disposition !== 'no_new_prose') {
    throw new Error('Script returned a writing response without a valid section_disposition.')
  }
  if (typeof parsed.revised_previous_tail !== 'string' || typeof parsed.new_prose !== 'string') {
    throw new Error('Script returned malformed rolling prose fields.')
  }
  if (parsed.section_disposition === 'prose' && !parsed.new_prose.trim()) {
    throw new Error('Script writing response declared prose but returned empty new_prose.')
  }
  if (parsed.section_disposition === 'no_new_prose' && parsed.new_prose.trim()) {
    throw new Error('Script writing response declared no_new_prose but returned new prose.')
  }
  return {
    section_disposition: parsed.section_disposition,
    revised_previous_tail: parsed.revised_previous_tail.trim(),
    new_prose: parsed.new_prose.trim(),
  }
}

const ROLLING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    section_disposition: { type: 'string', enum: ['prose', 'no_new_prose'] },
    revised_previous_tail: { type: 'string' },
    new_prose: { type: 'string' },
  },
  required: ['section_disposition', 'revised_previous_tail', 'new_prose'],
} as const

async function updateProjectAfterCompletion(supabase: ServerSupabase, userId: string, job: ShapeJobRow, now: string) {
  if (!job.project_id || !job.continuity) return
  const { error } = await supabase
    .from('shape_projects')
    .update({ continuity: job.continuity, completed_parts: job.project_part_number, updated_at: now })
    .eq('id', job.project_id)
    .eq('user_id', userId)
  if (error) throw new Error('Script finished this part but could not update the campaign project continuity.')
}

async function usageTotalsFromLedger(supabase: ServerSupabase, job: ShapeJobRow) {
  const { data, error } = await supabase
    .from('shape_usage_events')
    .select('input_tokens,cached_input_tokens,cache_write_tokens,output_tokens,success')
    .eq('job_id', job.id)

  if (error || !data) {
    console.error('Shape could not refresh aggregate usage from the ledger', error?.message || 'unknown error')
    return {
      input_tokens: job.input_tokens || 0,
      cached_input_tokens: job.cached_input_tokens || 0,
      cache_write_tokens: job.cache_write_tokens || 0,
      output_tokens: job.output_tokens || 0,
      request_count: job.request_count || 0,
    }
  }

  const totals = { input_tokens: 0, cached_input_tokens: 0, cache_write_tokens: 0, output_tokens: 0, request_count: 0 }
  for (const event of data as Array<{ input_tokens?: number | null; cached_input_tokens?: number | null; cache_write_tokens?: number | null; output_tokens?: number | null; success?: boolean | null }>) {
    if (!event.success) continue
    totals.input_tokens += Number(event.input_tokens || 0)
    totals.cached_input_tokens += Number(event.cached_input_tokens || 0)
    totals.cache_write_tokens += Number(event.cache_write_tokens || 0)
    totals.output_tokens += Number(event.output_tokens || 0)
    totals.request_count += 1
  }
  return totals
}

async function settleCompletedJob(supabase: ServerSupabase, userId: string, job: ShapeJobRow) {
  await settleShapeJobUsage(supabase, job)
  const { data } = await supabase.from('shape_jobs').select('*').eq('id', job.id).eq('user_id', userId).single()
  return (data || job) as ShapeJobRow
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData.user
  if (userError || !user) return Response.json({ error: 'Sign in before using Script.' }, { status: 401 })

  let body: { job_id?: unknown }
  try { body = await request.json() } catch { return Response.json({ error: 'Script could not read that processing request.' }, { status: 400 }) }
  const jobId = typeof body.job_id === 'string' ? body.job_id.trim() : ''
  if (!jobId) return Response.json({ error: 'This Script request is missing its job identifier.' }, { status: 400 })

  const { data, error } = await supabase.from('shape_jobs').select('*').eq('id', jobId).eq('user_id', user.id).single()
  if (error || !data) return Response.json({ error: 'Script could not find that saved job.' }, { status: 404 })
  const job = data as ShapeJobRow
  if (job.status === 'completed') {
    try {
      const settled = await settleCompletedJob(supabase, user.id, job)
      return Response.json({ job: serializeJob(settled, true) }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (caught) {
      return Response.json({ error: caught instanceof Error ? caught.message : 'Script could not settle this completed job.' }, { status: 500 })
    }
  }
  if (job.status === 'cancelled') return Response.json({ error: 'This Script job was discarded.' }, { status: 409 })

  const now = new Date().toISOString()

  try {
    const useSinglePass = !job.project_id && job.transcript.length <= SHAPE_SINGLE_PASS_CHARACTERS
    if (useSinglePass) {
      const userPrompt = `DOCUMENT TITLE: ${job.title}\n\nCOMPLETE RAW GAMEPLAY TRANSCRIPT:\n${job.transcript}`
      const step = await openAiStep(supabase, user.id, job, {
        phase: 'writing',
        operation: 'single:1/1',
        inputCharacters: job.transcript.length,
        system: `${SINGLE_PASS_PROMPT}\n\n${DESCRIPTION_PROMPTS[job.description_level]}`,
        user: userPrompt,
        maxOutputTokens: 12_000,
        idempotencyKey: `shape-${job.id}-single-${job.fingerprint}`,
      })
      const prose = outputText(step.payload)
      if (!prose) throw new Error('Script returned an empty story.')
      const usageTotals = await usageTotalsFromLedger(supabase, job)
      const update = {
        status: 'completed',
        phase: 'completed',
        next_chunk_index: 1,
        prose_text: prose,
        result_text: prose,
        prompt_version: SHAPE_PROMPT_VERSION,
        model: step.model,
        ...usageTotals,
        error_message: null,
        updated_at: now,
        completed_at: now,
      }
      const { data: saved, error: saveError } = await supabase.from('shape_jobs').update(update).eq('id', job.id).eq('user_id', user.id).select('*').single()
      if (saveError || !saved) throw new Error('Script finished the story but could not save it.')
      const settled = await settleCompletedJob(supabase, user.id, saved as ShapeJobRow)
      return Response.json({ job: serializeJob(settled, true) }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const analysisChunks = buildShapeAnalysisChunks(job.transcript)
    if (job.next_analysis_chunk_index < analysisChunks.length) {
      const index = job.next_analysis_chunk_index
      const userPrompt = [
        `DOCUMENT TITLE: ${job.title}`,
        `CAMPAIGN PART: ${job.project_part_number || 1}`,
        `CONTINUITY SECTION: ${index + 1} OF ${analysisChunks.length}`,
        `THIS IS THE FINAL CONTINUITY SECTION: ${index === analysisChunks.length - 1 ? 'YES' : 'NO'}`,
        `ROLLING CONTINUITY FROM EARLIER SECTIONS OF THIS SUBMISSION:\n${job.continuity || '[No earlier section continuity was supplied.]'}`,
        `PRIOR PROJECT CONTINUITY FROM EARLIER COMPLETED SUBMISSIONS:\n${job.prior_continuity || '[No earlier Shape project continuity was supplied.]'}`,
        `RAW GAMEPLAY TRANSCRIPT SECTION:\n${analysisChunks[index]}`,
      ].join('\n\n')
      const inputCharacters = analysisChunks[index].length + (job.continuity?.length || 0) + (job.prior_continuity?.length || 0)
      const step = await openAiStep(supabase, user.id, job, {
        phase: 'analysis',
        operation: `analysis:${index + 1}/${analysisChunks.length}`,
        inputCharacters,
        system: ANALYSIS_PROMPT,
        user: userPrompt,
        maxOutputTokens: 5_000,
        idempotencyKey: `shape-${job.id}-analysis-${index}-${job.fingerprint}`,
      })
      const continuity = parseContinuity(outputText(step.payload))
      const nextIndex = index + 1
      const usageTotals = await usageTotalsFromLedger(supabase, job)
      const update = {
        status: 'processing',
        phase: nextIndex >= analysisChunks.length ? 'writing' : 'analysis',
        continuity,
        next_analysis_chunk_index: nextIndex,
        prompt_version: SHAPE_PROMPT_VERSION,
        model: step.model,
        ...usageTotals,
        error_message: null,
        updated_at: now,
      }
      const { data: saved, error: saveError } = await supabase.from('shape_jobs').update(update).eq('id', job.id).eq('user_id', user.id).select('*').single()
      if (saveError || !saved) throw new Error('Script completed a continuity step but could not save the checkpoint.')
      return Response.json({ job: serializeJob(saved as ShapeJobRow) }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const chunks = buildShapeTranscriptChunks(job.transcript)
    if (job.next_chunk_index < chunks.length) {
      const index = job.next_chunk_index
      const chunk = chunks[index]

      const applyWritingResponse = (raw: string, existingProse: string, previousTail: string) => {
        const section = parseRolling(raw)
        if (section.revised_previous_tail.length > MAX_REVISED_PREVIOUS_PROSE_CHARACTERS) throw new Error('Script returned an oversized seam revision.')
        return reconcileShapeWritingSection(existingProse, previousTail, section.revised_previous_tail, section.new_prose, section.section_disposition)
      }

      const writingPrompt = (source: string, contextBefore: string, contextAfter: string, previousTail: string, label: string, isFinalSection: boolean) => [
        `DOCUMENT TITLE: ${job.title}`,
        label,
        `THIS IS THE FINAL SECTION: ${isFinalSection ? 'YES' : 'NO'}`,
        `CONTINUITY LEDGER:\n${job.continuity}`,
        `PREVIOUS PROSE TAIL (provisional; return a complete revised replacement):\n${previousTail || '[No previous prose. Return an empty revised_previous_tail.]'}`,
        `CONTEXT BEFORE (source overlap; use only to understand and repair the seam):\n${contextBefore || '[Beginning of transcript.]'}`,
        `NEW TRANSCRIPT MATERIAL (write this section):\n${source}`,
        `CONTEXT AFTER (lookahead only; understand consequences and corrections but do not write these events yet):\n${contextAfter || '[End of transcript.]'}`,
      ].join('\n\n')

      const runWritingCall = async (details: {
        source: string
        contextBefore: string
        contextAfter: string
        existingProse: string
        operation: string
        idempotencyKey: string
        label: string
        isFinalSection: boolean
        recoveryInstruction?: string
      }) => {
        const previousTail = details.existingProse ? provisionalProseTail(details.existingProse) : ''
        const userPrompt = writingPrompt(details.source, details.contextBefore, details.contextAfter, previousTail, details.label, details.isFinalSection)
        const inputCharacters = details.source.length + details.contextBefore.length + details.contextAfter.length + job.continuity.length + previousTail.length
        const step = await openAiStep(supabase, user.id, job, {
          phase: 'writing',
          operation: details.operation,
          inputCharacters,
          system: `${WRITING_PROMPT}\n\n${DESCRIPTION_PROMPTS[job.description_level]}${details.recoveryInstruction ? `\n\n${details.recoveryInstruction}` : ''}`,
          user: userPrompt,
          maxOutputTokens: 16_000,
          idempotencyKey: details.idempotencyKey,
          jsonSchema: { name: 'prosemaker_rolling_section', schema: ROLLING_SCHEMA as unknown as Record<string, unknown> },
        })
        return { proseText: applyWritingResponse(outputText(step.payload), details.existingProse, previousTail), model: step.model }
      }

      let proseText = job.prose_text.trim()
      let model = job.model || selectedShapeModel()
      let primaryFailure: Error | null = null

      try {
        const primary = await runWritingCall({
          source: chunk.source,
          contextBefore: chunk.contextBefore,
          contextAfter: chunk.contextAfter,
          existingProse: proseText,
          operation: `writing:${index + 1}/${chunks.length}:v2`,
          idempotencyKey: `shape-${job.id}-writing-v2-${index}-${job.fingerprint}`,
          label: `SECTION: ${index + 1} OF ${chunks.length}`,
          isFinalSection: index === chunks.length - 1,
        })
        proseText = primary.proseText
        model = primary.model
      } catch (caught) {
        primaryFailure = caught instanceof Error ? caught : new Error(String(caught))
        if (primaryFailure.message.startsWith('Provider ')) throw primaryFailure
        console.error('Shape primary writing reconciliation failed', primaryFailure.message)
      }

      if (primaryFailure) {
        try {
          const repaired = await runWritingCall({
            source: chunk.source,
            contextBefore: chunk.contextBefore,
            contextAfter: chunk.contextAfter,
            existingProse: proseText,
            operation: `writing-repair:${index + 1}/${chunks.length}:v2`,
            idempotencyKey: `shape-${job.id}-writing-repair-v2-${index}-${job.fingerprint}`,
            label: `RECOVERY PASS FOR SECTION: ${index + 1} OF ${chunks.length}`,
            isFinalSection: index === chunks.length - 1,
            recoveryInstruction: 'RECOVERY PASS: The previous attempt could not be incorporated safely. Return valid structured output. If the supplied previous prose tail needs no change, copy it back verbatim rather than omitting story material. Resolve explicit corrections and retcons from the continuity ledger. Preserve every story-bearing source event, but do not invent narrative prose for material that the main prompt tells you to omit. If the entire NEW TRANSCRIPT MATERIAL is administrative or otherwise legitimately non-narrative, return section_disposition no_new_prose with an empty new_prose.',
          })
          proseText = repaired.proseText
          model = repaired.model
          primaryFailure = null
        } catch (caught) {
          const repairFailure = caught instanceof Error ? caught : new Error(String(caught))
          if (repairFailure.message.startsWith('Provider ')) throw repairFailure
          console.error('Shape full-section repair failed', repairFailure.message)
          const recoveryParts = buildShapeRecoverySubchunks(chunk.source)
          if (recoveryParts.length <= 1) throw new Error(`Writing recovery failed: ${repairFailure.message}`)

          let consumed = 0
          for (let partIndex = 0; partIndex < recoveryParts.length; partIndex += 1) {
            const source = recoveryParts[partIndex]
            const beforeInsideChunk = chunk.source.slice(Math.max(0, consumed - 5_000), consumed)
            const afterStart = consumed + source.length
            const afterInsideChunk = chunk.source.slice(afterStart, Math.min(chunk.source.length, afterStart + 2_500))
            const contextBefore = [partIndex === 0 ? chunk.contextBefore : '', beforeInsideChunk].filter(Boolean).join('\n\n')
            const contextAfter = [afterInsideChunk, partIndex === recoveryParts.length - 1 ? chunk.contextAfter : ''].filter(Boolean).join('\n\n')
            const recovered = await runWritingCall({
              source,
              contextBefore,
              contextAfter,
              existingProse: proseText,
              operation: `writing-recovery:${index + 1}/${chunks.length}:${partIndex + 1}/${recoveryParts.length}:v2`,
              idempotencyKey: `shape-${job.id}-writing-recovery-v2-${index}-${partIndex}-${job.fingerprint}`,
              label: `RECOVERY SUBSECTION ${partIndex + 1} OF ${recoveryParts.length} FOR ORIGINAL SECTION ${index + 1} OF ${chunks.length}`,
              isFinalSection: index === chunks.length - 1 && partIndex === recoveryParts.length - 1,
              recoveryInstruction: 'RECOVERY SUBSECTION: This troublesome source section has been divided at natural boundaries. Write every story-bearing event in NEW TRANSCRIPT MATERIAL exactly once. If the supplied previous prose tail needs no change, copy it back verbatim. Do not omit confusing or corrected story material; use the continuity ledger to choose the final canon. Material that is entirely game administration, rules discussion, talk-to-text debris, repeated recap, or irrelevant out-of-character conversation may correctly return section_disposition no_new_prose with an empty new_prose.',
            })
            proseText = recovered.proseText
            model = recovered.model
            consumed += source.length
          }
          primaryFailure = null
        }
      }

      if (primaryFailure) throw primaryFailure

      const nextIndex = index + 1
      const complete = nextIndex >= chunks.length
      const usageTotals = await usageTotalsFromLedger(supabase, job)
      const update = {
        status: complete ? 'completed' : 'processing',
        phase: complete ? 'completed' : 'writing',
        prose_text: proseText,
        result_text: complete ? proseText : null,
        next_chunk_index: nextIndex,
        prompt_version: SHAPE_PROMPT_VERSION,
        model,
        ...usageTotals,
        error_message: null,
        updated_at: now,
        completed_at: complete ? now : null,
      }
      const { data: saved, error: saveError } = await supabase.from('shape_jobs').update(update).eq('id', job.id).eq('user_id', user.id).select('*').single()
      if (saveError || !saved) throw new Error('Script completed a writing step but could not save the checkpoint.')
      if (complete) {
        await updateProjectAfterCompletion(supabase, user.id, saved as ShapeJobRow, now)
        const settled = await settleCompletedJob(supabase, user.id, saved as ShapeJobRow)
        return Response.json({ job: serializeJob(settled, true) }, { headers: { 'Cache-Control': 'no-store' } })
      }
      return Response.json({ job: serializeJob(saved as ShapeJobRow, false) }, { headers: { 'Cache-Control': 'no-store' } })
    }

    if (job.project_id) await updateProjectAfterCompletion(supabase, user.id, job, now)
    const fallbackUpdate = { status: 'completed', phase: 'completed', result_text: job.prose_text, completed_at: now, updated_at: now, error_message: null }
    const { data: saved } = await supabase.from('shape_jobs').update(fallbackUpdate).eq('id', job.id).eq('user_id', user.id).select('*').single()
    const completedJob = (saved || job) as ShapeJobRow
    const settled = await settleCompletedJob(supabase, user.id, completedJob)
    return Response.json({ job: serializeJob(settled, true) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Script could not finish this processing step.'
    console.error('RPG Your Way Shape step failed', message)
    const publicMessage = message.startsWith('Script is not connected') ? message : 'Script could not finish this step. Your completed checkpoints are safe, and you can resume without starting over.'
    const usageTotals = await usageTotalsFromLedger(supabase, job)
    await supabase.from('shape_jobs').update({ status: 'error', error_message: publicMessage, ...usageTotals, updated_at: now }).eq('id', job.id).eq('user_id', user.id)
    const { data: refreshed } = await supabase.from('shape_jobs').select('*').eq('id', job.id).eq('user_id', user.id).single()
    const failedJob = refreshed ? refreshed as ShapeJobRow : { ...job, status: 'error', error_message: publicMessage, ...usageTotals } as ShapeJobRow
    return Response.json({
      error: publicMessage,
      job: serializeJob(failedJob, false, true),
    }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }
}
