import { NextResponse } from 'next/server'
import { CHARACTER_INTAKE_SCHEMA } from '@/lib/aigm/character-intake-schema'
import { normalizeCharacterIntakeResult } from '@/lib/aigm/character-intake-normalize'
import { characterFeatureEntries } from '@/lib/aigm/character-record'
import { enrichDnd55CharacterRecord } from '@/lib/aigm/srd-record-details'
import { isRateLimited } from '@/lib/aigm/rate-limit'
import {
  buildCharacterIntakeSystemPrompt,
  buildCharacterIntakeUserPrompt,
} from '@/lib/aigm/character-intake-prompt'
import {
  CHARACTER_INTAKE_ANALYSIS_REVISION,
  CHARACTER_INTAKE_VERSION,
} from '@/lib/aigm/version'
import { aiContentSafetyPrompt, normalizeAiContentMode } from '@/lib/site/ai-content-mode'
import { supportedSystemFor } from '@/lib/aigm/supported-systems'
import { formatRulesReference, rulesReferenceFor } from '@/lib/aigm/rules-library'
import { estimateTerraMaximumMicrousd, terraProviderCostMicrousd } from '@/lib/usage/play-cost'
import { billingErrorResponse, recordIncludedProviderUsage, releaseUsage, requireUsageAccount, reserveUsage, settleUsage, type UsageAccount, type UsageReservation } from '@/lib/usage/server-billing'
import type {
  CampaignStartMode,
  CharacterIntakeApiError,
  CharacterIntakeApiResponse,
  CharacterIntakeResult,
  CharacterIntakeSettings,
} from '@/lib/aigm/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_FILE_BYTES = 8 * 1024 * 1024
const MAX_TEXT_CHARACTERS = 120_000
const DEFAULT_MODEL = 'gpt-5.6-terra'
const MAX_ANALYSES_PER_HOUR = 20
const ONE_HOUR_MS = 60 * 60 * 1000
const ACCEPTED_TEXT_EXTENSIONS = new Set(['json', 'xml', 'txt', 'md', 'markdown'])

interface OpenAIResponsePayload {
  id?: string
  output_text?: string
  output?: Array<{
    type?: string
    content?: Array<{
      type?: string
      text?: string
      refusal?: string
    }>
  }>
  error?: {
    message?: string
    type?: string
    code?: string
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

function extensionFor(filename: string) {
  return filename.toLowerCase().split('.').pop() ?? ''
}

function hasPdfSignature(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString('ascii') === '%PDF-'
}

function likelyHasDigitalPdfText(buffer: Buffer): boolean {
  // This deliberately conservative preflight avoids sending obvious scans or
  // photographed sheets for costly visual analysis. Digitally generated PDFs
  // normally contain font dictionaries, text maps, or PDF text operators.
  const source = buffer.toString('latin1')
  const fontHints = (source.match(/\/(?:Type\s*\/Font|FontDescriptor|BaseFont)\b/g) ?? []).length
  const textMapHints = (source.match(/\/(?:ToUnicode|ActualText|StructTreeRoot)\b/g) ?? []).length
  const textOperators = (source.match(/(?:^|\s)(?:BT|Tj|TJ)(?:\s|$)/g) ?? []).length
  const imageHints = (source.match(/\/Subtype\s*\/Image\b/g) ?? []).length

  if (textMapHints > 0 || textOperators > 1) return true
  if (fontHints > 0 && imageHints === 0) return true
  return false
}

function parseSettings(formData: FormData): CharacterIntakeSettings {
  const rawMode = formData.get('campaign_start_mode')
  const campaignStartMode: CampaignStartMode =
    rawMode === 'continuing' ? 'continuing' : 'new_fully_rested'

  const requestedRuleset = String(formData.get('ruleset') || '').trim()
  const system = supportedSystemFor(requestedRuleset)
  return {
    campaign_start_mode: campaignStartMode,
    dont_sweat_small_stuff: formData.get('dont_sweat_small_stuff') !== 'false',
    ruleset: system.builtIn ? system.label : (system.requestedLabel || requestedRuleset || 'Other system'),
  }
}

function decodeStructuredText(buffer: Buffer, extension: string) {
  const decoded = buffer.toString('utf8').replace(/^\uFEFF/, '').trim()
  if (!decoded) throw new Error('EMPTY_TEXT')
  if (decoded.length > MAX_TEXT_CHARACTERS) throw new Error('TEXT_TOO_LARGE')

  if (extension === 'json') {
    try {
      return JSON.stringify(JSON.parse(decoded), null, 2)
    } catch {
      throw new Error('INVALID_JSON')
    }
  }

  if (extension === 'xml') {
    if (/<!DOCTYPE|<!ENTITY/i.test(decoded)) throw new Error('UNSAFE_XML')
    if (!/^\s*<[\s\S]+>\s*$/.test(decoded)) {
      throw new Error('INVALID_XML')
    }
  }

  return decoded
}

function looksLikeInternalRecordIssue(category: string, issue: string, why: string) {
  return /\b(?:arithmetic|calculation|math|internal|document|sheet|record|total|mismatch|contradiction)\b/i.test(`${category} ${issue} ${why}`)
}

async function groundDetectedIssues(
  request: Request,
  apiKey: string,
  model: string,
  settings: CharacterIntakeSettings,
  result: CharacterIntakeResult,
): Promise<{ result: CharacterIntakeResult; providerCostMicrousd: number; providerRequestId: string | null }> {
  if (!result.detected_issues.length) return { result, providerCostMicrousd: 0, providerRequestId: null }

  const system = supportedSystemFor(settings.ruleset)
  const classNames = result.character.classes.map((entry) => `${entry.name} ${entry.level}${entry.subclass ? ` ${entry.subclass}` : ''}`).join('; ')
  const spellNames = [
    ...result.character.spellcasting.cantrips,
    ...result.character.spellcasting.prepared_or_known_spells,
    ...result.character.spellcasting.spellbook_or_other_spells,
  ].slice(0, 80).join('; ')
  const featureNames = characterFeatureEntries(result).slice(0, 80).map((entry) => entry.name).join('; ')

  const evidence = result.detected_issues.slice(0, 12).map((issue, index) => {
    if (!system.builtIn) return { index, issue, reference: 'No built-in RPG Your Way rules corpus exists for this Other system.' }
    const query = [issue.category, issue.issue, issue.why_it_matters, classNames, spellNames, featureNames].join('\n')
    const reference = rulesReferenceFor(system, query, 3_500)
    return { index, issue, reference: formatRulesReference(reference) || 'No relevant local SRD excerpt was retrieved.' }
  })

  try {
    const verifyResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: 'low' },
        max_output_tokens: 1200,
        input: [
          {
            role: 'system',
            content: `You verify RPG Your Way Character Import notices. Return only indexes of issues that are justified. Never add or rewrite an issue.\n\nFor an internal contradiction or arithmetic problem that is evident from the supplied character record itself, the issue may be kept without a rules citation. For a claim that the selected game system says a character rule is wrong, keep it only when that issue's supplied LOCAL RULES REFERENCE directly supports the claimed contradiction. If the reference is absent, merely related, ambiguous, or does not support the claim, drop the issue. For an Other system with no built-in corpus, keep only internal/document contradictions; never validate an exact external rule from model memory.`,
          },
          {
            role: 'user',
            content: `SELECTED SYSTEM: ${settings.ruleset}\nCHARACTER: ${result.character.name}\nCLASSES: ${classNames}\n\nISSUES AND ISSUE-SPECIFIC LOCAL REFERENCES:\n${JSON.stringify(evidence, null, 2)}`,
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'wardenspc_grounded_issue_filter',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                keep_indexes: { type: 'array', items: { type: 'integer', minimum: 0 } },
              },
              required: ['keep_indexes'],
            },
          },
        },
      }),
      signal: AbortSignal.timeout(25_000),
    })
    const verifyPayload = (await verifyResponse.json()) as OpenAIResponsePayload
    const providerCostMicrousd = terraProviderCostMicrousd(verifyPayload.usage)
    const providerRequestId = verifyPayload.id || verifyResponse.headers.get('x-request-id')
    if (!verifyResponse.ok) throw new Error('Rules warning verifier failed.')
    const verifyText = extractOutputText(verifyPayload)
    if (!verifyText) throw new Error('Rules warning verifier returned no output.')
    const parsed = JSON.parse(verifyText) as { keep_indexes?: number[] }
    const keep = new Set((parsed.keep_indexes ?? []).filter((index) => Number.isInteger(index) && index >= 0 && index < result.detected_issues.length))
    return {
      result: { ...result, detected_issues: result.detected_issues.filter((_issue, index) => keep.has(index)) },
      providerCostMicrousd,
      providerRequestId,
    }
  } catch (error) {
    console.error('Character intake rules-warning verification failed; retaining only self-evident record issues.', { error })
    return {
      result: {
        ...result,
        detected_issues: result.detected_issues.filter((issue) => looksLikeInternalRecordIssue(issue.category, issue.issue, issue.why_it_matters)),
      },
      providerCostMicrousd: 0,
      providerRequestId: null,
    }
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
    return jsonError(
      503,
      'The AIGM connection is not configured yet.',
      requestId,
      'OPENAI_API_KEY is missing from the server environment.',
    )
  }


  if (isRateLimited(request, 'character-intake', MAX_ANALYSES_PER_HOUR, ONE_HOUR_MS)) {
    return jsonError(429, 'Too many character sheets have been submitted from this connection. Wait before trying again.', requestId)
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return jsonError(400, 'The upload could not be read.', requestId)
  }

  const upload = formData.get('file')
  if (!(upload instanceof File)) {
    return jsonError(400, 'Choose or paste one character record before asking AIGM to read it.', requestId)
  }

  if (upload.size <= 0) {
    return jsonError(400, 'The selected character record is empty.', requestId)
  }

  if (upload.size > MAX_FILE_BYTES) {
    return jsonError(413, 'The selected character record is larger than the 8 MB limit.', requestId)
  }

  const settings = parseSettings(formData)
  const contentMode = normalizeAiContentMode(formData.get('content_mode'))
  const extension = extensionFor(upload.name)
  const isPdf = upload.type === 'application/pdf' || extension === 'pdf'
  const isTextSource = ACCEPTED_TEXT_EXTENSIONS.has(extension)

  if (!isPdf && !isTextSource) {
    return jsonError(
      415,
      'RPG Your Way accepts digital PDF, JSON, XML, TXT, and Markdown character records.',
      requestId,
      'Photographs, scans, PNG, JPEG, WebP, image-only PDFs, ZIP archives, and unrelated documents are not accepted.',
    )
  }

  const buffer = Buffer.from(await upload.arrayBuffer())
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL
  const sourceContent: Array<Record<string, unknown>> = []
  let sourceText = ''

  if (isPdf) {
    if (!hasPdfSignature(buffer)) {
      return jsonError(415, 'The selected file does not appear to be a valid PDF.', requestId)
    }
    if (!likelyHasDigitalPdfText(buffer)) {
      return jsonError(
        415,
        'This appears to be a scanned, photographed, or image-only character sheet.',
        requestId,
        'RPG Your Way currently accepts digitally exported PDFs only. Type the character into TXT or Markdown, use JSON or XML, or paste the information directly.',
      )
    }

    sourceContent.push({
      type: 'input_file',
      filename: upload.name,
      file_data: `data:application/pdf;base64,${buffer.toString('base64')}`,
      detail: 'low',
    })
  } else {
    let structuredText: string
    try {
      structuredText = decodeStructuredText(buffer, extension)
    } catch (error) {
      const code = error instanceof Error ? error.message : ''
      if (code === 'EMPTY_TEXT') return jsonError(400, 'The selected character record is empty.', requestId)
      if (code === 'TEXT_TOO_LARGE') return jsonError(413, `Text character records are limited to ${MAX_TEXT_CHARACTERS.toLocaleString()} characters.`, requestId)
      if (code === 'INVALID_JSON') return jsonError(415, 'That JSON file is not valid JSON.', requestId)
      if (code === 'UNSAFE_XML') return jsonError(415, 'That XML file contains declarations AIGM does not accept.', requestId)
      if (code === 'INVALID_XML') return jsonError(415, 'That XML file does not appear to be valid XML.', requestId)
      return jsonError(415, 'That character record could not be read.', requestId)
    }

    sourceText = structuredText
    sourceContent.push({
      type: 'input_text',
      text: `SOURCE FILE: ${upload.name}\nSOURCE FORMAT: ${extension.toUpperCase()}\n\n${structuredText}`,
    })
  }

  sourceContent.push({
    type: 'input_text',
    text: `${buildCharacterIntakeUserPrompt(settings)}\n\nThe source may come from a character builder, a digital character sheet, or player-supplied structured text. Do not require a D&D Beyond layout. Analyze it as the selected ruleset/system in the intake settings. Use only the character information supplied; do not reproduce or invent sourcebook text.`,
  })

  // Ordinary character import is included. Very large inputs require explicit
  // permission before any customer balance can be used.
  const demandingImport = isPdf ? upload.size > 2 * 1024 * 1024 : sourceText.length > 60_000
  const allowPaid = formData.get('allow_paid') === 'true'
  const estimatedInputCharacters = isPdf
    ? Math.max(60_000, Math.min(700_000, Math.ceil(upload.size / 12)))
    : Math.max(1, sourceText.length)
  const maximumDeductionMicrousd = estimateTerraMaximumMicrousd(estimatedInputCharacters + 20_000, 12_000, 1.6, 10)

  if (demandingImport && !allowPaid) {
    return NextResponse.json({
      error: 'This character is unusually large or complex and requires additional AI processing.',
      code: 'paid_intake_confirmation_required',
      maximum_deduction_microusd: maximumDeductionMicrousd,
      request_id: requestId,
    }, { status: 409, headers: { 'Cache-Control': 'no-store' } })
  }

  let reservation: UsageReservation | null = null
  if (demandingImport) {
    try {
      reservation = await reserveUsage(account, {
        maximumMicrousd: maximumDeductionMicrousd,
        feature: 'character_import',
        sourceRef: upload.name,
        operationId: request.headers.get('x-rpgyw-operation-id') || requestId,
      })
    } catch (error) {
      return billingErrorResponse(error)
    }
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
        max_output_tokens: 12000,
        input: [
          {
            role: 'system',
            content: [buildCharacterIntakeSystemPrompt(settings), aiContentSafetyPrompt(contentMode)].filter(Boolean).join('\n\n'),
          },
          {
            role: 'user',
            content: sourceContent,
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'aigm_character_intake_1_4',
            strict: true,
            schema: CHARACTER_INTAKE_SCHEMA,
          },
        },
      }),
      signal: AbortSignal.timeout(85_000),
    })

    const payload = (await openAIResponse.json()) as OpenAIResponsePayload

    if (!openAIResponse.ok) {
      if (reservation) { await releaseUsage(reservation, { model, metadata: { reason: 'provider_error', status: openAIResponse.status } }); reservation = null }
      console.error('OpenAI character intake failed', {
        requestId,
        status: openAIResponse.status,
        error: payload.error,
      })

      return jsonError(
        502,
        'RPG Your Way had a temporary problem reading this character record. The file was not deleted.',
        requestId,
        'Try the same record again. If the problem continues, paste the character information as plain text.',
      )
    }

    const refusal = extractRefusal(payload)
    if (refusal) {
      if (reservation) { await releaseUsage(reservation, { model, metadata: { reason: 'provider_refusal' } }); reservation = null }
      console.error('Character intake was declined', { requestId, refusal })
      return jsonError(422, 'RPG Your Way could not use this character record.', requestId, 'Try again, or paste the character information as plain text.')
    }

    const outputText = extractOutputText(payload)
    if (!outputText) {
      if (reservation) { await releaseUsage(reservation, { model, metadata: { reason: 'empty_provider_output' } }); reservation = null }
      return jsonError(502, 'The AIGM returned no readable character intake.', requestId)
    }

    let result: CharacterIntakeResult
    try {
      result = normalizeCharacterIntakeResult(JSON.parse(outputText) as CharacterIntakeResult)
    } catch (error) {
      if (reservation) { await releaseUsage(reservation, { model, metadata: { reason: 'invalid_structured_output' } }); reservation = null }
      console.error('Character intake JSON parsing failed', { requestId, error, outputText })
      return jsonError(502, 'The AIGM returned an unreadable character intake.', requestId)
    }

    let verificationCostMicrousd = 0
    let verificationRequestId: string | null = null
    if (result.document_assessment.is_usable) {
      const verification = await groundDetectedIssues(request, apiKey, model, settings, result)
      result = verification.result
      verificationCostMicrousd = verification.providerCostMicrousd
      verificationRequestId = verification.providerRequestId
      result = enrichDnd55CharacterRecord(result).result
    }

    if (!result.document_assessment.is_usable) {
      if (reservation) { await releaseUsage(reservation, { model, metadata: { reason: 'unusable_character_record' } }); reservation = null }
      const kindMessage = result.document_assessment.kind === 'other_character_sheet'
        ? 'This appears to be a character record, but AIGM could not confirm enough usable rules information to run it.'
        : result.document_assessment.kind === 'unreadable'
          ? 'This character record could not be read well enough to use.'
          : 'This file does not appear to contain a usable tabletop roleplaying character record.'

      return jsonError(422, kindMessage, requestId, result.document_assessment.reason)
    }

    const providerCostMicrousd = terraProviderCostMicrousd(payload.usage) + verificationCostMicrousd
    let usageBilling = null
    if (reservation) {
      const billing = await settleUsage(reservation, {
        model,
        providerCostMicrousd,
        metadata: {
          provider_request_id: payload.id || openAIResponse.headers.get('x-request-id'),
          verification_request_id: verificationRequestId,
          verification_provider_cost_microusd: verificationCostMicrousd,
          source_file: upload.name,
        },
      })
      reservation = null
      usageBilling = { billed_microusd: billing.billedMicrousd, balance_microusd: billing.balanceMicrousd, owner_qa_exempt: billing.ownerQaExempt, settlement_warning: billing.settlementWarning }
    } else {
      await recordIncludedProviderUsage(account, {
        feature: 'character_import_included',
        operationId: request.headers.get('x-rpgyw-operation-id') || requestId,
        sourceRef: upload.name,
        model,
        providerCostMicrousd,
        metadata: {
          provider_request_id: payload.id || openAIResponse.headers.get('x-request-id'),
          verification_request_id: verificationRequestId,
          verification_provider_cost_microusd: verificationCostMicrousd,
        },
      })
    }

    const response: CharacterIntakeApiResponse & { paid_processing: boolean; usage_billing?: typeof usageBilling } = {
      result,
      model,
      request_id: payload.id || requestId,
      intake_version: CHARACTER_INTAKE_VERSION,
      analysis_revision: CHARACTER_INTAKE_ANALYSIS_REVISION,
      source_text: sourceText,
      paid_processing: demandingImport,
      ...(usageBilling ? { usage_billing: usageBilling } : {}),
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (reservation) await releaseUsage(reservation, { model: process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL, metadata: { reason: 'request_failure' } })
    console.error('Character intake request failed', { requestId, error })

    const details =
      error instanceof DOMException && error.name === 'TimeoutError'
        ? 'The analysis took too long. Try the same record again.'
        : 'Try the same record again. If the problem continues, paste the character information as plain text.'

    return jsonError(502, 'RPG Your Way had a temporary problem reading this character record. The file was not deleted.', requestId, details)
  }
}
