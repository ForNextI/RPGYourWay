import { shapeEmailAllowed } from '@/lib/shape/access'
import {
  SHAPE_SINGLE_PASS_CHARACTERS,
  buildShapeAnalysisChunks,
  buildShapeTranscriptChunks,
  provisionalProseTail,
  replaceProvisionalProseTail,
} from '@/lib/shape/transcript'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const DEFAULT_MODEL = 'gpt-5.6-terra'
const PROSEMAKER_VERSION = 'ProseMaker v5.1.0 · RPG Your Way'
const MAX_CONTINUITY_CHARACTERS = 20_000
const MAX_REVISED_PREVIOUS_PROSE_CHARACTERS = 14_000

const ANALYSIS_PROMPT = `You are ProseMaker's continuity editor. Read this chronological section of a raw tabletop roleplaying transcript and update the continuity ledger before any story prose is written. Do not write story prose yet.

Build and maintain a compact continuity ledger that the prose writer can use for every section. Record only story-bearing facts: character names, identities, pronouns, appearances, relationships, locations, chronology, possessions, injuries, conditions, discoveries, goals, unresolved threads, important dialogue or promises, and corrections. Ignore dice arithmetic, menus, rules administration, repeated narration, abandoned declarations, talk-to-text debris, and irrelevant out-of-character conversation.

TIME SCOPE IS CRITICAL. Do not flatten the campaign into its final state. Use these canon rules:
- RETROACTIVE CORRECTION: an earlier transcript statement was wrong and a player or Game Master explicitly corrects it. State what earlier fact is superseded and how far backward the correction applies. Continued play using a replacement is sufficient confirmation.
- SUPERSEDED ACTION: when a player changes or retracts a declared action before it is finally resolved, the corrected declaration wins. Remove the abandoned action even if the Game Master had already begun narrating it.
- REVELATION OR DISCOVERY: a fact may have been true earlier, but the characters or narrator did not know it yet. Preserve the earlier viewpoint and apply the knowledge only from the discovery point forward.
- FORWARD CHANGE: a name, title, relationship, allegiance, injury, possession, location, condition, identity choice, or other state changes during play. Preserve the old state before the effective point and the new state afterward.
- FIRST-ESTABLISHED FACT DEFAULT: if the transcript later contradicts an already established minor fact without an explicit correction or an in-story change, treat the earliest clear version as canon and the later isolated contradiction as accidental drift.
Never turn a development into a retcon merely because it appears later in the transcript.

When ROLLING CONTINUITY is supplied, merge it with the current transcript section into one updated, timeline-aware ledger. Process sections strictly in chronological order.

Return only valid JSON with this exact shape:
{"continuity":"compact timeline-aware continuity ledger","retcon_notices":[]}`

const SINGLE_PASS_PROMPT = `You are ProseMaker, a one-shot converter that turns a raw tabletop roleplaying transcript into finished third-person, past-tense fantasy prose. Read the entire transcript before writing and determine what actually happened. Respect chronology when resolving later information. An explicit player or Game Master correction can retroactively replace an earlier mistake. If a player changes or retracts an action before it is finally resolved, use only the corrected action. A later discovery or state change does not rewrite earlier scenes. When a later isolated detail contradicts an earlier established minor fact without an explicit correction or in-story change, keep the first-established fact and treat the later contradiction as drift.

Omit abandoned actions, dice arithmetic, menus, rules discussion, game administration, talk-to-text errors, repeated narration, and irrelevant out-of-character conversation. Tell each event once. Preserve player choices, sequence, identities, locations, injuries, actions, consequences, important dialogue, humor, tactics, spells, abilities, and established facts. Combine a player's declared action and the Game Master's result into one complete fictional event. Use maximum reasonable inference and minimum invention. Fill only obvious connective gaps and never invent unsupported events, motives, private thoughts, dialogue, discoveries, outcomes, or conclusions.

Build paragraphs around complete dramatic beats. Vary sentence length, use natural transitions, preserve distinctive speech, and favor specific source details over stock fantasy language. Check names, speakers, pronouns, locations, injuries, and actions before finalizing. Avoid commentary, headings, prefaces, markdown, manufactured endings, and false cliffhangers. Output only the finished prose.`

const WRITING_PROMPT = `You are ProseMaker, a rolling converter that turns raw tabletop roleplaying transcripts into finished third-person, past-tense fantasy prose.

The complete current transcript was analyzed before writing began. The CONTINUITY LEDGER is timeline-aware. Follow it without erasing chronology. Apply a later fact backward only when the ledger identifies it as a retroactive correction. A superseded declaration is not an event. Do not apply a revelation or forward change to earlier scenes.

You are writing one section of a longer document with a soft seam. CONTEXT BEFORE and CONTEXT AFTER overlap neighboring source sections. PREVIOUS PROSE TAIL is deliberately provisional and may be revised now that you can see both sides of the seam.

Return only valid JSON with exactly these fields: {"revised_previous_tail":"...","new_prose":"..."}. REVISED PREVIOUS PROSE TAIL must be a complete replacement for the supplied provisional tail. Preserve every real event already represented there while repairing repetition, false endings, awkward transitions, or continuity mistakes. If the supplied tail is empty, return an empty string. NEW PROSE must cover only NEW TRANSCRIPT MATERIAL and must not retell context overlap.

Resolve player declarations and Game Master results into complete fictional events. Omit abandoned actions, dice arithmetic, menus, rules discussion, game administration, talk-to-text errors, repeated narration, and irrelevant out-of-character conversation. Preserve player choices, sequence, identities, locations, injuries, actions, consequences, important dialogue, humor, tactics, spells, abilities, and established facts. Use maximum reasonable inference and minimum invention. Avoid commentary, summaries, headings, prefaces, markdown, manufactured endings, and false cliffhangers.`

const DESCRIPTION_PROMPTS = {
  plain: 'DESCRIPTION LEVEL: PLAIN AND SIMPLE. Write clean, economical prose. Add only the description needed for clarity, place, and continuity.',
  light: 'DESCRIPTION LEVEL: SLIGHTLY DESCRIPTIVE. Add selective sensory detail, smoother transitions, and a little atmosphere. Keep the prose natural and readable rather than ornate.',
  rich: 'DESCRIPTION LEVEL: VERY DESCRIPTIVE. Use fuller sensory detail, stronger scene texture, varied sentence rhythms, and more evocative language. Remain faithful to the transcript.',
  purple: 'DESCRIPTION LEVEL: EXCESSIVELY FLOWERY AND PURPLE. Deliberately use lavish, ornate, image-heavy prose and heightened metaphor while keeping events and outcomes faithful to the transcript.',
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
  status: 'processing' | 'error' | 'completed'
  phase: string
  analysis_total: number
  writing_total: number
  next_analysis_chunk_index: number
  next_chunk_index: number
  continuity: string
  prose_text: string
  result_text: string | null
  prompt_version: string | null
  input_tokens: number
  output_tokens: number
  error_message: string | null
  created_at: string
  updated_at: string
}

type OpenAiUsage = { input_tokens?: number; output_tokens?: number }

type OpenAiPayload = {
  id?: string
  output_text?: string
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>
  usage?: OpenAiUsage
}

function serializeJob(row: ShapeJobRow, includeResult = false) {
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

function selectedModel() {
  return process.env.OPENAI_SHAPE_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL
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

async function openAiResponse(system: string, user: string, maxOutputTokens: number, idempotencyKey: string) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('Shape is not connected to OPENAI_API_KEY.')
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      model: selectedModel(),
      store: false,
      reasoning: { effort: 'low' },
      max_output_tokens: maxOutputTokens,
      input: [
        { role: 'system', content: `${PROSEMAKER_VERSION}\n\n${system}` },
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(115_000),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('Shape OpenAI request failed', response.status, detail.slice(0, 1_000))
    throw new Error('The AI service did not complete this Shape step.')
  }
  return await response.json() as OpenAiPayload
}

function parseContinuity(raw: string) {
  const unfenced = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try {
    const parsed = JSON.parse(unfenced) as { continuity?: unknown }
    if (typeof parsed.continuity === 'string' && parsed.continuity.trim()) return parsed.continuity.trim().slice(0, MAX_CONTINUITY_CHARACTERS)
  } catch {}
  return unfenced.slice(0, MAX_CONTINUITY_CHARACTERS) || 'No additional continuity ledger was produced.'
}

function parseRolling(raw: string) {
  const unfenced = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const parsed = JSON.parse(unfenced) as { revised_previous_tail?: unknown; new_prose?: unknown }
  if (typeof parsed.revised_previous_tail !== 'string' || typeof parsed.new_prose !== 'string' || !parsed.new_prose.trim()) throw new Error('Shape returned an incomplete writing section.')
  return { revised_previous_tail: parsed.revised_previous_tail.trim(), new_prose: parsed.new_prose.trim() }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData.user
  if (userError || !user) return Response.json({ error: 'Sign in before using Shape.' }, { status: 401 })
  if (!shapeEmailAllowed(user.email)) return Response.json({ error: 'Shape processing is still limited to the private test list.' }, { status: 403 })

  let body: { job_id?: unknown }
  try { body = await request.json() } catch { return Response.json({ error: 'Shape could not read that processing request.' }, { status: 400 }) }
  const jobId = typeof body.job_id === 'string' ? body.job_id.trim() : ''
  if (!jobId) return Response.json({ error: 'This Shape request is missing its job identifier.' }, { status: 400 })

  const { data, error } = await supabase.from('shape_jobs').select('*').eq('id', jobId).eq('user_id', user.id).single()
  if (error || !data) return Response.json({ error: 'Shape could not find that saved job.' }, { status: 404 })
  const job = data as ShapeJobRow
  if (job.status === 'completed') return Response.json({ job: serializeJob(job, true) }, { headers: { 'Cache-Control': 'no-store' } })

  const now = new Date().toISOString()

  try {
    if (job.transcript.length <= SHAPE_SINGLE_PASS_CHARACTERS) {
      const response = await openAiResponse(
        `${SINGLE_PASS_PROMPT}\n\n${DESCRIPTION_PROMPTS[job.description_level]}`,
        `DOCUMENT TITLE: ${job.title}\n\nCOMPLETE RAW GAMEPLAY TRANSCRIPT:\n${job.transcript}`,
        12_000,
        `shape-${job.id}-single-${job.fingerprint}`,
      )
      const prose = outputText(response)
      if (!prose) throw new Error('Shape returned an empty story.')
      const usage = response.usage || {}
      const update = {
        status: 'completed',
        phase: 'completed',
        next_chunk_index: 1,
        prose_text: prose,
        result_text: prose,
        prompt_version: PROSEMAKER_VERSION,
        input_tokens: (job.input_tokens || 0) + (usage.input_tokens || 0),
        output_tokens: (job.output_tokens || 0) + (usage.output_tokens || 0),
        error_message: null,
        updated_at: now,
        completed_at: now,
      }
      const { data: saved, error: saveError } = await supabase.from('shape_jobs').update(update).eq('id', job.id).eq('user_id', user.id).select('*').single()
      if (saveError || !saved) throw new Error('Shape finished the story but could not save it.')
      return Response.json({ job: serializeJob(saved as ShapeJobRow, true) }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const analysisChunks = buildShapeAnalysisChunks(job.transcript)
    if (job.next_analysis_chunk_index < analysisChunks.length) {
      const index = job.next_analysis_chunk_index
      const response = await openAiResponse(
        ANALYSIS_PROMPT,
        [
          `DOCUMENT TITLE: ${job.title}`,
          `CONTINUITY SECTION: ${index + 1} OF ${analysisChunks.length}`,
          `THIS IS THE FINAL CONTINUITY SECTION: ${index === analysisChunks.length - 1 ? 'YES' : 'NO'}`,
          `ROLLING CONTINUITY FROM EARLIER SECTIONS:\n${job.continuity || '[No earlier continuity was supplied.]'}`,
          `RAW GAMEPLAY TRANSCRIPT SECTION:\n${analysisChunks[index]}`,
        ].join('\n\n'),
        5_000,
        `shape-${job.id}-analysis-${index}-${job.fingerprint}`,
      )
      const continuity = parseContinuity(outputText(response))
      const usage = response.usage || {}
      const nextIndex = index + 1
      const update = {
        status: 'processing',
        phase: nextIndex >= analysisChunks.length ? 'writing' : 'analysis',
        continuity,
        next_analysis_chunk_index: nextIndex,
        prompt_version: PROSEMAKER_VERSION,
        input_tokens: (job.input_tokens || 0) + (usage.input_tokens || 0),
        output_tokens: (job.output_tokens || 0) + (usage.output_tokens || 0),
        error_message: null,
        updated_at: now,
      }
      const { data: saved, error: saveError } = await supabase.from('shape_jobs').update(update).eq('id', job.id).eq('user_id', user.id).select('*').single()
      if (saveError || !saved) throw new Error('Shape completed a continuity step but could not save the checkpoint.')
      return Response.json({ job: serializeJob(saved as ShapeJobRow) }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const chunks = buildShapeTranscriptChunks(job.transcript)
    if (job.next_chunk_index < chunks.length) {
      const index = job.next_chunk_index
      const chunk = chunks[index]
      const previousTail = index > 0 ? provisionalProseTail(job.prose_text) : ''
      const response = await openAiResponse(
        `${WRITING_PROMPT}\n\n${DESCRIPTION_PROMPTS[job.description_level]}`,
        [
          `DOCUMENT TITLE: ${job.title}`,
          `SECTION: ${index + 1} OF ${chunks.length}`,
          `THIS IS THE FINAL SECTION: ${index === chunks.length - 1 ? 'YES' : 'NO'}`,
          `CONTINUITY LEDGER:\n${job.continuity}`,
          `PREVIOUS PROSE TAIL:\n${previousTail || '[No previous prose. Return an empty revised_previous_tail.]'}`,
          `CONTEXT BEFORE:\n${chunk.contextBefore || '[Beginning of transcript.]'}`,
          `NEW TRANSCRIPT MATERIAL:\n${chunk.source}`,
          `CONTEXT AFTER:\n${chunk.contextAfter || '[End of transcript.]'}`,
        ].join('\n\n'),
        16_000,
        `shape-${job.id}-writing-${index}-${job.fingerprint}`,
      )
      const section = parseRolling(outputText(response))
      if (section.revised_previous_tail.length > MAX_REVISED_PREVIOUS_PROSE_CHARACTERS) throw new Error('Shape returned an oversized seam revision.')
      if (previousTail && !section.revised_previous_tail) throw new Error('Shape did not return the previous prose seam revision.')
      if (!previousTail && section.revised_previous_tail) throw new Error('Shape unexpectedly returned prose before the first section.')

      const revisedExisting = previousTail ? replaceProvisionalProseTail(job.prose_text, previousTail, section.revised_previous_tail) : job.prose_text.trim()
      const proseText = [revisedExisting, section.new_prose].filter(Boolean).join('\n\n').trim()
      const usage = response.usage || {}
      const nextIndex = index + 1
      const complete = nextIndex >= chunks.length
      const update = {
        status: complete ? 'completed' : 'processing',
        phase: complete ? 'completed' : 'writing',
        prose_text: proseText,
        result_text: complete ? proseText : null,
        next_chunk_index: nextIndex,
        prompt_version: PROSEMAKER_VERSION,
        input_tokens: (job.input_tokens || 0) + (usage.input_tokens || 0),
        output_tokens: (job.output_tokens || 0) + (usage.output_tokens || 0),
        error_message: null,
        updated_at: now,
        completed_at: complete ? now : null,
      }
      const { data: saved, error: saveError } = await supabase.from('shape_jobs').update(update).eq('id', job.id).eq('user_id', user.id).select('*').single()
      if (saveError || !saved) throw new Error('Shape completed a writing step but could not save the checkpoint.')
      return Response.json({ job: serializeJob(saved as ShapeJobRow, complete) }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const fallbackUpdate = { status: 'completed', phase: 'completed', result_text: job.prose_text, completed_at: now, updated_at: now, error_message: null }
    const { data: saved } = await supabase.from('shape_jobs').update(fallbackUpdate).eq('id', job.id).eq('user_id', user.id).select('*').single()
    return Response.json({ job: serializeJob((saved || job) as ShapeJobRow, true) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Shape could not finish this processing step.'
    console.error('RPG Your Way Shape step failed', message)
    const publicMessage = message.startsWith('Shape is not connected') ? message : 'Shape could not finish this step. The saved job can be resumed without starting over.'
    await supabase.from('shape_jobs').update({ status: 'error', error_message: publicMessage, updated_at: now }).eq('id', job.id).eq('user_id', user.id)
    const { data: refreshed } = await supabase.from('shape_jobs').select('*').eq('id', job.id).eq('user_id', user.id).single()
    return Response.json({ error: publicMessage, job: refreshed ? serializeJob(refreshed as ShapeJobRow) : serializeJob({ ...job, status: 'error', error_message: publicMessage } as ShapeJobRow) }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }
}
