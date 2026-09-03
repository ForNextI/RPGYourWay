import { NextResponse } from 'next/server'
import { START_FAQ, START_HELP_KNOWLEDGE } from '@/lib/start/help-knowledge'
import { isRateLimited } from '@/lib/aigm/rate-limit'
import { estimateTerraMaximumMicrousd, terraProviderCostMicrousd } from '@/lib/usage/play-cost'
import {
  billingErrorResponse,
  releaseUsage,
  requireUsageAccount,
  reserveUsage,
  settleUsage,
  type UsageAccount,
  type UsageReservation,
} from '@/lib/usage/server-billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const DEFAULT_MODEL = 'gpt-5.6-terra'
const MAX_QUESTIONS_PER_HOUR = 25

interface OpenAIResponsePayload {
  id?: string
  output_text?: string
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>
  error?: { message?: string }
  usage?: unknown
}

function extractText(payload: OpenAIResponsePayload) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text.trim()
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string' && content.text.trim()) return content.text.trim()
    }
  }
  return ''
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID()
  let account: UsageAccount
  try {
    account = await requireUsageAccount()
  } catch (error) {
    return billingErrorResponse(error)
  }

  if (isRateLimited(request, 'start-page-help', MAX_QUESTIONS_PER_HOUR, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Start Page Help has reached its question limit for this connection. Try again later.' }, { status: 429 })
  }

  let body: { question?: string }
  try {
    body = (await request.json()) as { question?: string }
  } catch {
    return NextResponse.json({ error: 'The help question could not be read.' }, { status: 400 })
  }

  const question = body.question?.trim() || ''
  if (!question) return NextResponse.json({ error: 'Type a question first.' }, { status: 400 })
  if (question.length > 1_500) return NextResponse.json({ error: 'Keep the help question under 1,500 characters.' }, { status: 413 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Start Page Help is not configured yet.' }, { status: 503 })

  const faq = START_FAQ.map(([q, a]) => `Q: ${q}\nA: ${a}`).join('\n\n')
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL
  let reservation: UsageReservation | null = null

  try {
    reservation = await reserveUsage(account, {
      maximumMicrousd: estimateTerraMaximumMicrousd(
        START_HELP_KNOWLEDGE.length + faq.length + question.length + 2_000,
        500,
        1.6,
        1,
      ),
      feature: 'start_page_help',
      sourceRef: 'start-help',
      operationId: request.headers.get('x-rpgyw-operation-id') || requestId,
    })
  } catch (error) {
    return billingErrorResponse(error)
  }

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: 'low' },
        max_output_tokens: 500,
        input: [
          {
            role: 'system',
            content: `${START_HELP_KNOWLEDGE}\n\nKNOWN START-PAGE FAQ:\n${faq}\n\nAnswer only from this supplied RPG Your Way information. If the answer is not here, say that briefly instead of guessing. Keep the answer practical and concise.`,
          },
          { role: 'user', content: question },
        ],
      }),
      signal: AbortSignal.timeout(22_000),
    })

    const payload = (await response.json()) as OpenAIResponsePayload
    if (!response.ok) {
      if (reservation) {
        await releaseUsage(reservation, { model, metadata: { reason: 'provider_error', status: response.status } })
        reservation = null
      }
      return NextResponse.json({ error: payload.error?.message || 'Start Page Help could not answer right now.' }, { status: 502 })
    }

    const answer = extractText(payload)
    if (!answer) {
      if (reservation) {
        await releaseUsage(reservation, { model, metadata: { reason: 'empty_provider_output' } })
        reservation = null
      }
      return NextResponse.json({ error: 'Start Page Help returned no answer.' }, { status: 502 })
    }

    if (!reservation) return NextResponse.json({ error: 'Start Page Help could not confirm usage for this request.' }, { status: 503 })

    const billing = await settleUsage(reservation, {
      model,
      providerCostMicrousd: terraProviderCostMicrousd(payload.usage),
      metadata: { provider_request_id: payload.id || response.headers.get('x-request-id') },
    })
    reservation = null

    return NextResponse.json({
      answer,
      usage_billing: {
        billed_microusd: billing.billedMicrousd,
        balance_microusd: billing.balanceMicrousd,
        owner_qa_exempt: billing.ownerQaExempt,
        settlement_warning: billing.settlementWarning,
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (reservation) await releaseUsage(reservation, { model, metadata: { reason: 'request_failure' } })
    return NextResponse.json({ error: 'The browser help service could not complete that question.' }, { status: 502 })
  }
}
