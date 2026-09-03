import { NextResponse } from 'next/server'
import { CHARACTER_INTAKE_SCHEMA } from '@/lib/aigm/character-intake-schema'
import { normalizeCharacterIntakeResult } from '@/lib/aigm/character-intake-normalize'
import { isRateLimited } from '@/lib/aigm/rate-limit'
import { buildCharacterClarificationSystemPrompt } from '@/lib/aigm/character-intake-prompt'
import {
  CHARACTER_INTAKE_ANALYSIS_REVISION,
  CHARACTER_INTAKE_VERSION,
} from '@/lib/aigm/version'
import { aiContentSafetyPrompt, normalizeAiContentMode } from '@/lib/site/ai-content-mode'
import { estimateTerraMaximumMicrousd, terraProviderCostMicrousd } from '@/lib/usage/play-cost'
import { billingErrorResponse, releaseUsage, requireUsageAccount, reserveUsage, settleUsage, type UsageAccount, type UsageReservation } from '@/lib/usage/server-billing'
import type {
  CharacterIntakeApiError,
  CharacterIntakeApiResponse,
  CharacterIntakeResult,
  CharacterIntakeSettings,
} from '@/lib/aigm/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 90

const DEFAULT_MODEL = 'gpt-5.6-terra'
const MAX_MESSAGE_LENGTH = 2000
const MAX_INTAKE_JSON_LENGTH = 300_000
const MAX_UPDATES_PER_TEN_MINUTES = 40
const TEN_MINUTES_MS = 10 * 60 * 1000

interface ClarifyRequestBody {
  intake?: CharacterIntakeResult
  settings?: CharacterIntakeSettings
  message?: string
  content_mode?: unknown
  bill_usage?: boolean
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
  error?: {
    message?: string
  }
  usage?: unknown
}

function jsonError(
  status: number,
  error: string,
  requestId: string,
  details?: string,
) {
  const body: CharacterIntakeApiError = {
    error,
    request_id: requestId,
    ...(details ? { details } : {}),
  }
  return NextResponse.json(body, { status })
}

function extractOutputText(payload: OpenAIResponsePayload): string | null {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text
  }

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        return content.text
      }
    }
  }

  return null
}

function extractRefusal(payload: OpenAIResponsePayload): string | null {
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'refusal' && typeof content.refusal === 'string') {
        return content.refusal
      }
    }
  }

  return null
}

function settingsFromBody(body: ClarifyRequestBody): CharacterIntakeSettings {
  const candidate = body.settings ?? body.intake?.intake_settings

  return {
    campaign_start_mode:
      candidate?.campaign_start_mode === 'continuing' ? 'continuing' : 'new_fully_rested',
    dont_sweat_small_stuff: candidate?.dont_sweat_small_stuff !== false,
    ruleset: typeof candidate?.ruleset === 'string' && candidate.ruleset.trim() ? candidate.ruleset.trim() : 'D&D 5.5e (2024 rules)',
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID()
  let account: UsageAccount
  try {
    account = await requireUsageAccount()
  } catch (error) {
    return billingErrorResponse(error)
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return jsonError(503, 'The AIGM connection is not configured yet.', requestId)
  }


  if (isRateLimited(request, 'character-clarify', MAX_UPDATES_PER_TEN_MINUTES, TEN_MINUTES_MS)) {
    return jsonError(429, 'Too many character updates have been requested from this connection. Wait a few minutes and try again.', requestId)
  }

  let body: ClarifyRequestBody
  try {
    body = (await request.json()) as ClarifyRequestBody
  } catch {
    return jsonError(400, 'The clarification message could not be read.', requestId)
  }

  const message = body.message?.trim() || ''
  if (!message) {
    return jsonError(400, 'Type an answer before sending it.', requestId)
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return jsonError(413, 'The clarification message is too long for this request.', requestId)
  }

  if (!body.intake || typeof body.intake !== 'object') {
    return jsonError(400, 'The current character intake is missing.', requestId)
  }

  const serializedIntake = JSON.stringify(body.intake)
  if (serializedIntake.length > MAX_INTAKE_JSON_LENGTH) {
    return jsonError(413, 'The current character record is too large for game-creation chat.', requestId)
  }

  const settings = settingsFromBody(body)
  const contentMode = normalizeAiContentMode(body.content_mode)
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL
  let reservation: UsageReservation | null = null
  try {
    reservation = await reserveUsage(account, {
      maximumMicrousd: estimateTerraMaximumMicrousd(serializedIntake.length + message.length + 12_000, 10_000, 1.6, 10),
      feature: 'character_import_clarification',
      sourceRef: body.intake.character.name || 'character',
      operationId: request.headers.get('x-rpgyw-operation-id') || requestId,
    })
  } catch (error) {
    return billingErrorResponse(error)
  }

  try {
    const openAIResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        store: false,
        reasoning: {
          effort: 'medium',
        },
        max_output_tokens: 10000,
        input: [
          {
            role: 'system',
            content: [buildCharacterClarificationSystemPrompt(settings), aiContentSafetyPrompt(contentMode)].filter(Boolean).join('\n\n'),
          },
          {
            role: 'user',
            content: `CURRENT INTAKE:\n${serializedIntake}\n\nPLAYER ANSWER:\n${message}`,
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'aigm_character_intake_1_3_1',
            strict: true,
            schema: CHARACTER_INTAKE_SCHEMA,
          },
        },
      }),
      signal: AbortSignal.timeout(80_000),
    })

    const payload = (await openAIResponse.json()) as OpenAIResponsePayload

    if (!openAIResponse.ok) {
      if (reservation) { await releaseUsage(reservation, { model, metadata: { reason: 'provider_error', status: openAIResponse.status } }); reservation = null }
      console.error('OpenAI clarification failed', {
        requestId,
        status: openAIResponse.status,
        error: payload.error,
      })
      return jsonError(
        502,
        'The AIGM could not process that clarification.',
        requestId,
        payload.error?.message,
      )
    }

    const refusal = extractRefusal(payload)
    if (refusal) {
      if (reservation) { await releaseUsage(reservation, { model, metadata: { reason: 'provider_refusal' } }); reservation = null }
      return jsonError(422, 'The AIGM declined that clarification.', requestId, refusal)
    }

    const outputText = extractOutputText(payload)
    if (!outputText) {
      if (reservation) { await releaseUsage(reservation, { model, metadata: { reason: 'empty_provider_output' } }); reservation = null }
      return jsonError(502, 'The AIGM returned no readable update.', requestId)
    }

    let result: CharacterIntakeResult
    try {
      const parsedResult = normalizeCharacterIntakeResult(JSON.parse(outputText) as CharacterIntakeResult)
      result = {
        ...parsedResult,
        character: {
          ...parsedResult.character,
          is_current_party_active_leader: body.intake?.character.is_current_party_active_leader === true,
        },
      }
    } catch (error) {
      if (reservation) { await releaseUsage(reservation, { model, metadata: { reason: 'invalid_structured_output' } }); reservation = null }
      console.error('Clarification JSON parsing failed', { requestId, error, outputText })
      return jsonError(502, 'The AIGM returned an unreadable update.', requestId)
    }

    const providerCostMicrousd = terraProviderCostMicrousd(payload.usage)
    let usageBilling = null
    if (reservation) {
      const billing = await settleUsage(reservation, {
        model,
        providerCostMicrousd,
        metadata: { provider_request_id: payload.id || openAIResponse.headers.get('x-request-id'), character: body.intake.character.name },
      })
      reservation = null
      usageBilling = { billed_microusd: billing.billedMicrousd, balance_microusd: billing.balanceMicrousd, owner_qa_exempt: billing.ownerQaExempt, settlement_warning: billing.settlementWarning }
    }

    const response: CharacterIntakeApiResponse & { usage_billing?: typeof usageBilling } = {
      result,
      model,
      request_id: payload.id || requestId,
      intake_version: CHARACTER_INTAKE_VERSION,
      analysis_revision: CHARACTER_INTAKE_ANALYSIS_REVISION,
      ...(usageBilling ? { usage_billing: usageBilling } : {}),
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (reservation) await releaseUsage(reservation, { model, metadata: { reason: 'request_failure' } })
    console.error('Clarification request failed', { requestId, error })
    return jsonError(
      502,
      'The AIGM could not process that clarification.',
      requestId,
      'The server could not complete the AI request.',
    )
  }
}
