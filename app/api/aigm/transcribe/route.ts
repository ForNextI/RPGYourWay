import { NextResponse } from 'next/server'
import { isRateLimited } from '@/lib/aigm/rate-limit'
import { isKnownPhantomTranscription, transcriptionPromptFor } from '@/lib/aigm/transcription-guard'
import { billingErrorResponse, requireUsageAccount } from '@/lib/usage/server-billing'

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
  try {
    await requireUsageAccount()
  } catch (error) {
    return billingErrorResponse(error)
  }

  const apiKey = process.env.OPENAI_API_KEY
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
  if (!(audio instanceof File) || audio.size === 0) return NextResponse.json({ error: 'No microphone recording was received.' }, { status: 400 })
  if (audio.size > MAX_AUDIO_BYTES) return NextResponse.json({ error: 'That recording is too long. Keep spoken turns under two minutes.' }, { status: 413 })

  const model = process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || DEFAULT_MODEL
  const upstreamForm = new FormData()
  upstreamForm.append('file', audio, audio.name || 'rpgyw-turn.webm')
  upstreamForm.append('model', model)
  upstreamForm.append('language', 'en')
  upstreamForm.append('prompt', transcriptionPromptFor('gameplay'))
  upstreamForm.append('stream', 'true')

  let upstream: Response
  try {
    upstream = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstreamForm,
      signal: AbortSignal.timeout(55_000),
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'The transcription connection failed.' }, { status: 502 })
  }

  if (!upstream.ok || !upstream.body) {
    const payload = await upstream.json().catch(() => ({})) as { error?: { message?: string } }
    return NextResponse.json({ error: payload.error?.message || 'The transcription service could not read that recording.' }, { status: upstream.status || 502 })
  }

  const contentType = upstream.headers.get('content-type') || ''
  if (!contentType.includes('text/event-stream')) {
    const payload = await upstream.json().catch(() => ({})) as { text?: string; error?: { message?: string } }
    const text = typeof payload.text === 'string' ? payload.text.trim() : ''
    if (!text || isKnownPhantomTranscription(text)) {
      return NextResponse.json({ error: payload.error?.message || 'No speech was detected in that recording.' }, { status: 422 })
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

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let transcript = ''

      function consumeEventBlock(eventBlock: string) {
        for (const eventLine of eventBlock.split('\n')) {
          if (!eventLine.startsWith('data:')) continue
          const raw = eventLine.slice(5).trim()
          if (!raw || raw === '[DONE]') continue
          const event = JSON.parse(raw) as { type?: string; delta?: string; text?: string; message?: string; error?: { message?: string } }
          if (event.type === 'transcript.text.delta' && event.delta) transcript += event.delta
          else if (event.type === 'transcript.text.done' && typeof event.text === 'string') transcript = event.text
          else if (event.type === 'error') throw new Error(event.error?.message || event.message || 'The transcription service returned an error.')
        }
      }

      function consumeBufferedEvents(final = false) {
        buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''
        for (const eventBlock of events) consumeEventBlock(eventBlock)
        if (final && buffer.trim()) {
          consumeEventBlock(buffer)
          buffer = ''
        }
      }

      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          consumeBufferedEvents()
        }
        buffer += decoder.decode()
        consumeBufferedEvents(true)
        const finalText = transcript.trim()
        if (!finalText || isKnownPhantomTranscription(finalText)) throw new Error('No speech was detected in that recording.')
        controller.enqueue(line({ type: 'done', text: finalText }))
      } catch (error) {
        controller.enqueue(line({ type: 'error', error: error instanceof Error ? error.message : 'The transcription stream failed.' }))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
