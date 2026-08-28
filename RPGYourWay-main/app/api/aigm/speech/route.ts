import { NextResponse } from 'next/server'
import { isRateLimited } from '@/lib/aigm/rate-limit'
import { billingErrorResponse, requireUsageAccount } from '@/lib/usage/server-billing'
import { ttsProviderCostMicrousdFromWav } from '@/lib/usage/audio-cost'
import {
  ensurePlayTurn,
  ensureReplayReservation,
  maybeSettlePlayTurn,
  recordPlayTurnComponent,
  type PlayTurnSettlement,
} from '@/lib/usage/play-turn-billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_TEXT_LENGTH = 950
const MAX_REQUESTS_PER_TEN_MINUTES = 180
const WINDOW_MS = 10 * 60 * 1000
const DEFAULT_MODEL = 'gpt-4o-mini-tts'

type NarrationVoice = 'fable' | 'marin'
type NarrationProfile = 'gameplay' | 'onboarding'
type SpeechBillingMode = 'live' | 'replay'

function speakingInstructions(voice: NarrationVoice, profile: NarrationProfile) {
  if (profile === 'onboarding') return 'Read this RPG Your Way onboarding or setup-help reply clearly and naturally. Use warm, conversational pacing and clear diction. Do not perform it as an in-world character or announce stage directions.'
  const shared = 'Speak as a warm, intelligent tabletop fantasy Game Master. Use natural conversational pacing, clear diction, restrained theatricality, and brief pauses that suit narration and dialogue. Do not announce stage directions or describe the voice.'
  return voice === 'marin'
    ? `${shared} Use a natural, educated British English accent. Keep it consistent and understated, never exaggerated.`
    : `${shared} Preserve the voice’s natural British character.`
}

function settlementHeaders(settlement: PlayTurnSettlement | null) {
  const headers: Record<string, string> = {}
  if (!settlement?.settled) return headers
  headers['X-RPGYW-Turn-Settled'] = '1'
  headers['X-RPGYW-Owner-QA'] = settlement.ownerQaExempt ? '1' : '0'
  if (settlement.balanceMicrousd !== null) headers['X-RPGYW-Balance-Microusd'] = String(settlement.balanceMicrousd)
  return headers
}

export async function POST(request: Request) {
  let account
  try {
    account = await requireUsageAccount()
  } catch (error) {
    return billingErrorResponse(error)
  }

  const apiKey = process.env.OPENAI_TTS_API_KEY?.trim()
    || process.env.OPENAI_AUDIO_API_KEY?.trim()
    || process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return NextResponse.json({ error: 'AIGM narration is not configured yet.' }, { status: 503 })
  if (isRateLimited(request, 'aigm-speech', MAX_REQUESTS_PER_TEN_MINUTES, WINDOW_MS)) {
    return NextResponse.json({ error: 'This connection has requested too much narration in a short period. Wait a few minutes and try again.' }, { status: 429 })
  }

  let body: {
    text?: unknown
    voice?: unknown
    profile?: unknown
    billing_turn_id?: unknown
    component_id?: unknown
    billing_mode?: unknown
  }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ error: 'The narration request could not be read.' }, { status: 400 })
  }

  const text = typeof body.text === 'string' ? body.text.replace(/\s+/g, ' ').trim() : ''
  const voice: NarrationVoice = body.voice === 'marin' ? 'marin' : 'fable'
  const profile: NarrationProfile = body.profile === 'onboarding' ? 'onboarding' : 'gameplay'
  const billingMode: SpeechBillingMode = body.billing_mode === 'replay' ? 'replay' : 'live'
  const turnId = typeof body.billing_turn_id === 'string' ? body.billing_turn_id.trim() : ''
  const componentId = typeof body.component_id === 'string' && body.component_id.trim() ? body.component_id.trim() : crypto.randomUUID()
  if (!text) return NextResponse.json({ error: 'There is nothing to narrate.' }, { status: 400 })
  if (text.length > MAX_TEXT_LENGTH) return NextResponse.json({ error: 'That narration passage is too long.' }, { status: 413 })

  if (profile === 'gameplay') {
    if (!turnId) return NextResponse.json({ error: 'This narration request is missing its billing id. Please try Listen again.' }, { status: 400 })
    try {
      if (billingMode === 'replay') await ensureReplayReservation(account, turnId)
      else await ensurePlayTurn(account, { turnId, kind: 'live' })
    } catch (error) {
      return billingErrorResponse(error)
    }
  }

  const model = process.env.OPENAI_TTS_MODEL?.trim() || DEFAULT_MODEL
  if (profile === 'gameplay') {
    try {
      await recordPlayTurnComponent(account, {
        turnId,
        componentId,
        componentType: 'tts',
        status: 'pending',
        model,
        kind: billingMode === 'replay' ? 'replay' : 'live',
        metadata: { characters: text.length, voice, billing_mode: billingMode },
      })
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'RPG Your Way could not prepare narration billing.' }, { status: 503 })
    }
  }

  let upstream: Response
  try {
    upstream = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        voice,
        input: text,
        instructions: speakingInstructions(voice, profile),
        response_format: 'wav',
      }),
      signal: AbortSignal.timeout(55_000),
    })
  } catch (error) {
    if (profile === 'gameplay') {
      await recordPlayTurnComponent(account, {
        turnId,
        componentId,
        componentType: 'tts',
        status: 'failed',
        model,
        kind: billingMode === 'replay' ? 'replay' : 'live',
        metadata: { reason: 'provider_connection_failure', characters: text.length, voice },
      }).catch(() => undefined)
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'The narration connection failed.' }, { status: 502 })
  }

  if (!upstream.ok) {
    const payload = await upstream.json().catch(() => ({})) as { error?: { message?: string } }
    if (profile === 'gameplay') {
      await recordPlayTurnComponent(account, {
        turnId,
        componentId,
        componentType: 'tts',
        status: 'failed',
        model,
        kind: billingMode === 'replay' ? 'replay' : 'live',
        metadata: {
          reason: 'provider_error',
          status: upstream.status,
          provider_request_id: upstream.headers.get('x-request-id'),
          characters: text.length,
          voice,
        },
      }).catch(() => undefined)
    }
    return NextResponse.json({ error: payload.error?.message || 'The narration service could not speak this passage.' }, { status: upstream.status || 502 })
  }

  let audio: ArrayBuffer
  let measurement: ReturnType<typeof ttsProviderCostMicrousdFromWav>
  try {
    audio = await upstream.arrayBuffer()
    measurement = ttsProviderCostMicrousdFromWav(audio)
  } catch (error) {
    if (profile === 'gameplay') {
      await recordPlayTurnComponent(account, {
        turnId,
        componentId,
        componentType: 'tts',
        status: 'failed',
        model,
        kind: billingMode === 'replay' ? 'replay' : 'live',
        metadata: { reason: 'wav_measurement_failure', characters: text.length, voice },
      }).catch(() => undefined)
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'The narration audio could not be measured.' }, { status: 502 })
  }

  let settlement: PlayTurnSettlement | null = null
  if (profile === 'gameplay') {
    try {
      await recordPlayTurnComponent(account, {
        turnId,
        componentId,
        componentType: 'tts',
        status: 'success',
        model,
        providerCostMicrousd: measurement.providerCostMicrousd,
        kind: billingMode === 'replay' ? 'replay' : 'live',
        metadata: {
          provider_request_id: upstream.headers.get('x-request-id'),
          characters: text.length,
          voice,
          billing_mode: billingMode,
          audio_bytes: audio.byteLength,
          wav_data_bytes: measurement.dataBytes,
          wav_byte_rate: measurement.byteRate,
          duration_seconds: measurement.durationSeconds,
          estimator_microusd_per_second: measurement.estimatorMicrousdPerSecond,
          tts_cost_is_estimate: true,
        },
      })
      settlement = await maybeSettlePlayTurn(account, turnId)
    } catch (error) {
      console.error('TTS usage could not be recorded.', error)
      return NextResponse.json({ error: 'RPG Your Way could not record this readback against your Play balance. Please try again.' }, { status: 503 })
    }
  }

  return new Response(audio, {
    status: 200,
    headers: {
      'Content-Type': 'audio/wav',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...settlementHeaders(settlement),
    },
  })
}
