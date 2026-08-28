import { NextResponse } from 'next/server'
import { isRateLimited } from '@/lib/aigm/rate-limit'
import { isKnownPhantomTranscription, transcriptionPromptFor } from '@/lib/aigm/transcription-guard'
import { billingErrorResponse, requireUsageAccount } from '@/lib/usage/server-billing'
import { transcriptionProviderCostMicrousd } from '@/lib/usage/audio-cost'
import { ensurePlayTurn, recordPlayTurnComponent } from '@/lib/usage/play-turn-billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_AUDIO_BYTES = 15 * 1024 * 1024
const MAX_REQUESTS_PER_TEN_MINUTES = 30
const WINDOW_MS = 10 * 60 * 1000
const DEFAULT_MODEL = 'gpt-4o-mini-transcribe'

function line(value: unknown) {
  return new TextEncoder().encode(`${JSON.stringify(value)}\n`)
}

export async function POST(request: Request) {
  let account
  try {
    account = await requireUsageAccount()
  } catch (error) {
    return billingErrorResponse(error)
  }

  const apiKey = process.env.OPENAI_TRANSCRIBE_API_KEY?.trim()
    || process.env.OPENAI_AUDIO_API_KEY?.trim()
    || process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return NextResponse.json({ error: 'Voice transcription is not configured yet.' }, { status: 503 })
  if (isRateLimited(request, 'aigm-transcription', MAX_REQUESTS_PER_TEN_MINUTES, WINDOW_MS)) {
    return NextResponse.json({ error: 'This connection has sent too many microphone recordings in a short period. Wait a few minutes and try again.' }, { status: 429 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'The microphone recording could not be read.' }, { status: 400 })
  }

  const audio = form.get('audio')
  const context = form.get('context') === 'onboarding' ? 'onboarding' : 'gameplay'
  const turnId = typeof form.get('turn_id') === 'string' ? String(form.get('turn_id')).trim() : ''
  const componentId = typeof form.get('component_id') === 'string' ? String(form.get('component_id')).trim() : crypto.randomUUID()
  if (!(audio instanceof File) || audio.size === 0) return NextResponse.json({ error: 'No microphone recording was received.' }, { status: 400 })
  if (audio.size > MAX_AUDIO_BYTES) return NextResponse.json({ error: 'That recording is too long. Keep spoken turns under two minutes.' }, { status: 413 })

  if (context === 'gameplay') {
    if (!turnId) return NextResponse.json({ error: 'This spoken turn is missing its billing id. Please try recording it again.' }, { status: 400 })
    try {
      await ensurePlayTurn(account, { turnId, kind: 'live' })
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Play turn billing could not be prepared.' }, { status: 400 })
    }
  }

  const model = process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || DEFAULT_MODEL
  const upstreamForm = new FormData()
  upstreamForm.append('file', audio, audio.name || 'rpgyw-turn.webm')
  upstreamForm.append('model', model)
  upstreamForm.append('language', 'en')
  upstreamForm.append('prompt', transcriptionPromptFor(context))

  let upstream: Response
  try {
    upstream = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstreamForm,
      signal: AbortSignal.timeout(55_000),
    })
  } catch (error) {
    if (context === 'gameplay' && turnId) {
      await recordPlayTurnComponent(account, {
        turnId,
        componentId,
        componentType: 'ttt',
        status: 'failed',
        model,
        metadata: { reason: 'provider_connection_failure' },
      }).catch(() => undefined)
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'The transcription connection failed.' }, { status: 502 })
  }

  const payload = await upstream.json().catch(() => ({})) as {
    text?: string
    usage?: unknown
    error?: { message?: string }
  }
  const providerCostMicrousd = transcriptionProviderCostMicrousd(payload.usage)

  if (!upstream.ok) {
    if (context === 'gameplay' && turnId) {
      await recordPlayTurnComponent(account, {
        turnId,
        componentId,
        componentType: 'ttt',
        status: 'failed',
        model,
        providerCostMicrousd,
        metadata: { reason: 'provider_error', status: upstream.status, provider_request_id: upstream.headers.get('x-request-id') },
      }).catch(() => undefined)
    }
    return NextResponse.json({ error: payload.error?.message || 'The transcription service could not read that recording.' }, { status: upstream.status || 502 })
  }

  const text = typeof payload.text === 'string' ? payload.text.trim() : ''
  if (!text || isKnownPhantomTranscription(text)) {
    if (context === 'gameplay' && turnId) {
      await recordPlayTurnComponent(account, {
        turnId,
        componentId,
        componentType: 'ttt',
        status: 'success',
        model,
        providerCostMicrousd,
        metadata: { reason: 'no_speech', provider_request_id: upstream.headers.get('x-request-id'), usable_transcript: false },
      }).catch(() => undefined)
    }
    return NextResponse.json({ error: 'No speech was detected in that recording.' }, { status: 422 })
  }

  if (context === 'gameplay' && turnId) {
    try {
      await recordPlayTurnComponent(account, {
        turnId,
        componentId,
        componentType: 'ttt',
        status: 'success',
        model,
        providerCostMicrousd,
        metadata: {
          provider_request_id: upstream.headers.get('x-request-id'),
          audio_bytes: audio.size,
        },
      })
    } catch (error) {
      console.error('Talk-to-text usage could not be recorded.', error)
      return NextResponse.json({ error: 'RPG Your Way could not record this transcription against your Play balance. Please try again.' }, { status: 503 })
    }
  }

  return new Response(line({ type: 'done', text }), {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
