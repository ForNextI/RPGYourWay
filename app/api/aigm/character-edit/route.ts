import { NextResponse } from 'next/server'
import { CHARACTER_EDIT_SCHEMA } from '@/lib/aigm/character-edit-schema'
import { buildCharacterEditSystemPrompt } from '@/lib/aigm/character-edit-prompt'
import { classifyCharacterEditIntent } from '@/lib/aigm/character-edit-intent'
import { mergeCharacterEditProposalBoundary } from '@/lib/aigm/character-edit-policy'
import { normalizeCharacterIntakeResult } from '@/lib/aigm/character-intake-normalize'
import { enrichDnd55CharacterRecord } from '@/lib/aigm/srd-record-details'
import { compactSavedAdvancementProfiles, enrichFromSavedCharacterRules } from '@/lib/aigm/saved-record-details'
import { isRateLimited } from '@/lib/aigm/rate-limit'
import { billingErrorResponse, releaseUsage, requireUsageAccount, reserveUsage, settleUsage } from '@/lib/usage/server-billing'
import { estimateTerraMaximumMicrousd, terraProviderCostMicrousd } from '@/lib/usage/play-cost'
import type {
  CharacterEditApiResponse,
  CharacterEditProposal,
  CharacterIntakeApiError,
  CharacterIntakeResult,
} from '@/lib/aigm/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const DEFAULT_MODEL = 'gpt-5.6-terra'
const MAX_EDIT_CHARACTERS = 60_000
const MAX_EDITS_PER_HOUR = 30
const ONE_HOUR_MS = 60 * 60 * 1000

interface CharacterEditBody {
  current_result?: CharacterIntakeResult
  current_play_name?: string
  edit_text?: string
  source_text?: string
  advancement_profiles?: unknown
}

interface OpenAIResponsePayload {
  id?: string
  output_text?: string
  output?: Array<{
    content?: Array<{
      type?: string
      text?: string
      refusal?: string
    }>
  }>
  usage?: unknown
  error?: {
    message?: string
    type?: string
    code?: string
  }
}

function jsonError(status: number, error: string, requestId: string, details?: string) {
  const body: CharacterIntakeApiError = {
    error,
    request_id: requestId,
    ...(details ? { details } : {}),
  }
  return NextResponse.json(body, { status })
}

function extractOutputText(payload: OpenAIResponsePayload) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text
    }
  }
  return null
}

function extractRefusal(payload: OpenAIResponsePayload) {
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'refusal' && typeof content.refusal === 'string') return content.refusal
    }
  }
  return null
}

function cleanList(value: unknown, count: number, maximum: number) {
  if (!Array.isArray(value)) return []
  return value
    .slice(0, count)
    .map((entry) => typeof entry === 'string' ? entry.replace(/\s+/g, ' ').trim().slice(0, maximum) : '')
    .filter(Boolean)
}

function comparableRecord(result: CharacterIntakeResult) {
  return JSON.stringify({
    character: result.character,
    sheet_summary: result.sheet_summary,
    detected_issues: result.detected_issues,
    clarification_questions: result.clarification_questions,
    details_not_found: result.details_not_found,
    additional_details: result.additional_details,
  })
}

function looksLikeCharacterResult(value: unknown): value is CharacterIntakeResult {
  if (!value || typeof value !== 'object') return false
  const result = value as Partial<CharacterIntakeResult>
  return Boolean(
    result.character &&
    typeof result.character === 'object' &&
    typeof result.character.name === 'string' &&
    Array.isArray(result.character.classes) &&
    result.opening_state &&
    result.intake_settings,
  )
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID()
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return jsonError(
      503,
      'The AIGM connection is not configured yet.',
      requestId,
      'OPENAI_API_KEY is missing from the server environment.',
    )
  }

  if (isRateLimited(request, 'character-edit', MAX_EDITS_PER_HOUR, ONE_HOUR_MS)) {
    return jsonError(429, 'Too many character edits have been submitted from this connection. Wait before trying again.', requestId)
  }

  let body: CharacterEditBody
  try {
    body = (await request.json()) as CharacterEditBody
  } catch {
    return jsonError(400, 'The character edit could not be read.', requestId)
  }

  const editText = typeof body.edit_text === 'string' ? body.edit_text.trim() : ''
  if (!editText) return jsonError(400, 'Paste the additions or corrections before asking AIGM to read them.', requestId)
  if (editText.length > MAX_EDIT_CHARACTERS) {
    return jsonError(413, `Pasted character edits are limited to ${MAX_EDIT_CHARACTERS.toLocaleString()} characters.`, requestId)
  }
  if (!looksLikeCharacterResult(body.current_result)) {
    return jsonError(400, 'The current character record is missing or unreadable.', requestId)
  }

  let usageAccount
  try {
    usageAccount = await requireUsageAccount()
  } catch (error) {
    return billingErrorResponse(error)
  }

  let originalResult: CharacterIntakeResult
  try {
    originalResult = normalizeCharacterIntakeResult(body.current_result)
  } catch {
    return jsonError(400, 'The current character record is missing or unreadable.', requestId)
  }

  const enrichment = enrichDnd55CharacterRecord(originalResult)
  const savedAdvancementProfiles = compactSavedAdvancementProfiles(body.advancement_profiles)
  const savedRulesEnrichment = enrichFromSavedCharacterRules(enrichment.result, savedAdvancementProfiles)
  const editIntent = classifyCharacterEditIntent(editText)
  const rulesRefreshRequest = editIntent.rulesRefresh
  const broadRefreshRequest = editIntent.broadRefresh
  const currentResult = savedRulesEnrichment.result
  const savedSourceText = typeof body.source_text === 'string' ? body.source_text.slice(0, 60_000) : ''
  const currentPlayName = typeof body.current_play_name === 'string' ? body.current_play_name.replace(/\s+/g, ' ').trim().slice(0, 12) : ''
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL
  const context = {
    current_character_record: currentResult,
    current_name_used_in_play: currentPlayName,
    player_supplied_edit_text: editText,
    player_supplied_saved_source_text: savedSourceText,
    player_supplied_saved_advancement_profiles: savedAdvancementProfiles,
    rpgyw_built_in_srd_enrichment_already_applied: enrichment.added.length > 0 || enrichment.expanded.length > 0,
    rpgyw_saved_player_source_enrichment_already_applied: savedRulesEnrichment.added.length > 0 || savedRulesEnrichment.expanded.length > 0,
    rpgyw_broad_character_refresh_requested: broadRefreshRequest,
  }

  let reservation
  try {
    const systemPrompt = buildCharacterEditSystemPrompt()
    const userPrompt = `${JSON.stringify(context)}

RPG Your Way has already applied any safely identifiable built-in D&D 5.5e SRD rule details and any safely reusable player-supplied saved feature details to CURRENT CHARACTER RECORD. Preserve them. You may use PLAYER-SUPPLIED SAVED SOURCE TEXT and PLAYER-SUPPLIED SAVED ADVANCEMENT PROFILES as character-specific source data. Saved advancement profiles are authoritative for feature names, levels, progression values, and any feature_details they actually contain. Older saved profiles may contain names and numbers without the original rules prose; do not invent missing prose for those older entries. If rpgyw_broad_character_refresh_requested is true, treat the request as permission to apply every safe positive detail available from the supplied material, including rules details; optional information that is simply absent should be left unchanged rather than turned into a blocking question.`
    reservation = await reserveUsage(usageAccount, {
      maximumMicrousd: estimateTerraMaximumMicrousd(systemPrompt.length + userPrompt.length, 16_000, 1.55, 10),
      feature: 'character-edit',
      sourceRef: currentResult.character.name || 'character',
      operationId: request.headers.get('x-rpgyw-operation-id') || requestId,
    })
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: 'medium' },
        max_output_tokens: 16000,
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: systemPrompt }],
          },
          {
            role: 'user',
            content: [{
              type: 'input_text',
              text: userPrompt
            }],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'aigm_character_edit_1_0',
            strict: true,
            schema: CHARACTER_EDIT_SCHEMA,
          },
        },
      }),
      signal: AbortSignal.timeout(110_000),
    })

    const payload = (await response.json()) as OpenAIResponsePayload
    if (!response.ok) {
      await releaseUsage(reservation, { model, metadata: { reason: 'provider_error', status: response.status } })
      reservation = null
      console.error('OpenAI character edit failed', {
        requestId,
        status: response.status,
        error: payload.error,
      })
      return jsonError(
        502,
        'RPG Your Way had a temporary problem reading those character changes.',
        requestId,
        'Nothing was saved. Try the same text again.',
      )
    }

    const refusal = extractRefusal(payload)
    if (refusal) {
      console.error('Character edit was declined', { requestId, refusal })
      await releaseUsage(reservation, { model, metadata: { reason: 'provider_refusal' } })
      reservation = null
      return jsonError(422, 'RPG Your Way could not use those character changes.', requestId, 'Nothing was saved. Revise the pasted text and try again.')
    }

    const outputText = extractOutputText(payload)
    if (!outputText) {
      await releaseUsage(reservation, { model, metadata: { reason: 'empty_provider_output' } })
      reservation = null
      return jsonError(502, 'The AIGM returned no readable character edit.', requestId)
    }

    let parsed: CharacterEditProposal
    try {
      parsed = JSON.parse(outputText) as CharacterEditProposal
    } catch (error) {
      console.error('Character edit JSON parsing failed', { requestId, error, outputText })
      await releaseUsage(reservation, { model, metadata: { reason: 'invalid_structured_output' } })
      reservation = null
      return jsonError(502, 'The AIGM returned an unreadable character edit.', requestId)
    }

    let proposedResult: CharacterIntakeResult
    let proposedEnrichment = enrichment
    try {
      proposedResult = normalizeCharacterIntakeResult(
        mergeCharacterEditProposalBoundary(currentResult, parsed.proposed_result),
      )
      proposedEnrichment = enrichDnd55CharacterRecord(proposedResult)
      proposedResult = proposedEnrichment.result
      const proposedSavedRules = enrichFromSavedCharacterRules(proposedResult, savedAdvancementProfiles)
      proposedResult = proposedSavedRules.result
      savedRulesEnrichment.added.push(...proposedSavedRules.added)
      savedRulesEnrichment.expanded.push(...proposedSavedRules.expanded)
      savedRulesEnrichment.unresolved.push(...proposedSavedRules.unresolved)
    } catch (error) {
      console.error('Character edit normalization failed', { requestId, error })
      await releaseUsage(reservation, { model, metadata: { reason: 'invalid_character_record' } })
      reservation = null
      return jsonError(502, 'The proposed character record could not be validated.', requestId, 'Nothing was saved.')
    }

    const responseBody: CharacterEditApiResponse = {
      assistant_message: typeof parsed.assistant_message === 'string'
        ? parsed.assistant_message.slice(0, 1200)
        : 'Review the proposed character changes before saving.',
      can_save: Boolean(parsed.can_save),
      change_summary: cleanList(parsed.change_summary, 40, 240),
      duplicate_warnings: cleanList(parsed.duplicate_warnings, 20, 240),
      blocking_questions: cleanList(parsed.blocking_questions, 12, 300),
      proposed_play_name: typeof parsed.proposed_play_name === 'string'
        ? parsed.proposed_play_name.replace(/\s+/g, ' ').trim().slice(0, 12)
        : currentPlayName,
      proposed_result: proposedResult,
      model,
      request_id: payload.id || requestId,
    }

    if (!responseBody.proposed_play_name) responseBody.proposed_play_name = currentPlayName || proposedResult.character.name.split(/\s+/)[0]?.slice(0, 12) || 'Hero'
    const enrichmentNames = Array.from(new Set([
      ...enrichment.added, ...enrichment.expanded,
      ...savedRulesEnrichment.added, ...savedRulesEnrichment.expanded,
      ...proposedEnrichment.added, ...proposedEnrichment.expanded,
    ]))
    const unresolvedRules = Array.from(new Set(savedRulesEnrichment.unresolved))
    if (enrichmentNames.length > 0 && !responseBody.change_summary.some((item) => /SRD|rules detail|feature detail/i.test(item))) {
      responseBody.change_summary.unshift(`Fill in saved rules details for ${enrichmentNames.slice(0, 8).join(', ')}${enrichmentNames.length > 8 ? ` and ${enrichmentNames.length - 8} more` : ''}.`)
    }
    if (rulesRefreshRequest && unresolvedRules.length > 0) {
      responseBody.duplicate_warnings.push(`Older saved advancement data identifies ${unresolvedRules.slice(0, 8).join(', ')}${unresolvedRules.length > 8 ? ` and ${unresolvedRules.length - 8} more` : ''}, but those older profiles retained the feature names without the original rules prose. Those entries are left unchanged unless you supply the missing feature text once more.`)
    }
    const actualRecordChanged = comparableRecord(originalResult) !== comparableRecord(proposedResult)
      || responseBody.proposed_play_name !== currentPlayName
    if (actualRecordChanged && (rulesRefreshRequest || broadRefreshRequest) && responseBody.blocking_questions.length > 0) {
      responseBody.duplicate_warnings.push(...responseBody.blocking_questions.map((question) => `Unresolved optional or ambiguous material left unchanged: ${question}`))
      responseBody.blocking_questions = []
    }
    if (actualRecordChanged && enrichmentNames.length > 0 && responseBody.blocking_questions.length === 0) {
      responseBody.can_save = true
      if (!parsed.can_save || rulesRefreshRequest) {
        responseBody.assistant_message = unresolvedRules.length > 0
          ? 'RPG Your Way found rules details it can safely add to this character. Review the proposed enriched record before saving. Some older unsupported advancement entries contain only feature names because earlier RPG Your Way imports did not retain their source prose.'
          : 'RPG Your Way found rules details it can safely add to this character. Review the proposed enriched record before saving.'
      }
    }
    if (actualRecordChanged && broadRefreshRequest && responseBody.blocking_questions.length === 0) {
      responseBody.can_save = true
      if (responseBody.change_summary.length === 0) responseBody.change_summary = ['Fill in the available missing character details.']
      responseBody.assistant_message = unresolvedRules.length > 0
        ? 'RPG Your Way found character details it can safely add. Review the proposed changes before saving. Anything genuinely unavailable or ambiguous has been left unchanged, and some older unsupported advancement entries may still need their original rules text supplied once more.'
        : 'RPG Your Way found character details it can safely add. Review the proposed changes before saving; anything genuinely unavailable or ambiguous has been left unchanged.'
    }
    if (!actualRecordChanged) {
      responseBody.can_save = false
      responseBody.change_summary = []
      if (broadRefreshRequest && responseBody.blocking_questions.length > 0) {
        responseBody.duplicate_warnings.push(...responseBody.blocking_questions.map((question) => `Unavailable or ambiguous detail left unchanged: ${question}`))
        responseBody.blocking_questions = []
      }
      if (rulesRefreshRequest && unresolvedRules.length > 0) {
        responseBody.assistant_message = 'RPG Your Way checked the saved character and advancement data. The remaining unsupported entries come from older profiles that retained feature names but not the original rules prose, so those details cannot be reconstructed safely without the source text being supplied again.'
      } else if (broadRefreshRequest) {
        responseBody.assistant_message = 'RPG Your Way checked the character for every safe detail it could add. No further savable detail was found; unavailable optional information has been left unchanged.'
      } else if (responseBody.blocking_questions.length === 0) {
        responseBody.assistant_message = 'I couldn’t make a savable character-record change from that request.'
      }
    }
    if (responseBody.change_summary.length === 0) responseBody.can_save = false
    if (responseBody.blocking_questions.length > 0) responseBody.can_save = false

    const billing = await settleUsage(reservation, {
      model,
      providerCostMicrousd: terraProviderCostMicrousd(payload.usage),
      metadata: { provider_request_id: payload.id || response.headers.get('x-request-id') },
    })
    reservation = null
    return NextResponse.json({
      ...responseBody,
      usage_billing: {
        billed_microusd: billing.billedMicrousd,
        balance_microusd: billing.balanceMicrousd,
        owner_qa_exempt: billing.ownerQaExempt,
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (reservation) await releaseUsage(reservation, { model, metadata: { reason: 'request_failure' } })
    if (error && typeof error === 'object' && 'status' in error) return billingErrorResponse(error)
    console.error('Character edit request failed', { requestId, error })
    const details = error instanceof DOMException && error.name === 'TimeoutError'
      ? 'The analysis took too long. Nothing was saved. Try again.'
      : 'Nothing was saved. Try the same text again.'
    return jsonError(502, 'RPG Your Way had a temporary problem reading those character changes.', requestId, details)
  }
}
