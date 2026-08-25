import { NextResponse } from 'next/server'
import { isRateLimited } from '@/lib/aigm/rate-limit'
import { billingErrorResponse, requireUsageAccount } from '@/lib/usage/server-billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_TEXT_LENGTH = 950
const MAX_REQUESTS_PER_TEN_MINUTES = 180
const WINDOW_MS = 10 * 60 * 1000
const DEFAULT_MODEL = 'gpt-4o-mini-tts'

type NarrationVoice = 'fable' | 'marin'

function speakingInstructions(voice: NarrationVoice) {
  const shared = 'Speak as a warm, intelligent tabletop fantasy Game Master. Use natural conversational pacing, clear diction, restrained theatricality, and brief pauses that suit narration and dialogue. Do not announce stage directions or describe the voice.'
  return voice === 'marin'
    ? `${shared} Use a natural, educated British English accent. Keep it consistent and understated, never exaggerated.`
    : `${shared} Preserve the voice’s natural British character.`
}

export async function POST(request: Request) {
  let account
  try {
    account = await requireUsageAccount()
  } catch (error) {
    return billingErrorResponse(error)
  }
  if (!account.ownerQa) {
    return NextResponse.json({ error: 'Voice is being readied for prepaid Play billing. Typed Play is available now.' }, { status: 503 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AIGM narration is not configured yet.' }, { status: 503 })
  if (isRateLimited(request, 'aigm-speech', MAX_REQUESTS_PER_TEN_MINUTES, WINDOW_MS)) {
    return NextResponse.json({ error: 'This connection has requested too much narration in a short period. Wait a few minutes and try again.' }, { status: 429 })
  }

  let body: { text?: unknown; voice?: unknown }
  try {
    body = await request.json() as { text?: unknown; voice?: unknown }
  } catch {
    return NextResponse.json({ error: 'The narration request could not be read.' }, { status: 400 })
  }

  const text = typeof body.text === 'string' ? body.text.replace(/\s+/g, ' ').trim() : ''
  const voice: NarrationVoice = body.voice === 'marin' ? 'marin' : 'fable'
  if (!text) return NextResponse.json({ error: 'There is nothing to narrate.' }, { status: 400 })
  if (text.length > MAX_TEXT_LENGTH) return NextResponse.json({ error: 'That narration passage is too long.' }, { status: 413 })

  const model = process.env.OPENAI_TTS_MODEL?.trim() || DEFAULT_MODEL
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
        instructions: speakingInstructions(voice),
        response_format: 'mp3',
        stream_format: 'audio',
      }),
      signal: AbortSignal.timeout(55_000),
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'The narration connection failed.' }, { status: 502 })
  }

  if (!upstream.ok || !upstream.body) {
    const payload = await upstream.json().catch(() => ({})) as { error?: { message?: string } }
    return NextResponse.json({ error: payload.error?.message || 'The narration service could not speak this passage.' }, { status: upstream.status || 502 })
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
