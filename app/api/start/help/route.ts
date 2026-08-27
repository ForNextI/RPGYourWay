import { NextResponse } from 'next/server'
import { START_FAQ, START_HELP_KNOWLEDGE } from '@/lib/start/help-knowledge'
import { createClient } from '@/lib/supabase/server'
import { isRateLimited } from '@/lib/aigm/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const DEFAULT_MODEL = 'gpt-5.6-terra'
const MAX_QUESTIONS_PER_HOUR = 25

interface OpenAIResponsePayload {
  output_text?: string
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>
  error?: { message?: string }
}

function outputText(payload: OpenAIResponsePayload) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text.trim()
  for (const item of payload.output ?? []) for (const content of item.content ?? []) if (content.type === 'output_text' && content.text?.trim()) return content.text.trim()
  return ''
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return NextResponse.json({ error: 'Sign in to use Start Page Help.' }, { status: 401 })
  if (isRateLimited(request, 'start-page-help', MAX_QUESTIONS_PER_HOUR, 60 * 60 * 1000)) return NextResponse.json({ error: 'Start Page Help has received too many questions from this connection. Try again later.' }, { status: 429 })

  const body = await request.json().catch(() => null) as { question?: unknown } | null
  const question = typeof body?.question === 'string' ? body.question.trim().slice(0, 1500) : ''
  if (!question) return NextResponse.json({ error: 'Enter a question first.' }, { status: 400 })
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Start Page Help is not configured yet.' }, { status: 503 })

  const faq = START_FAQ.map(([q, a]) => `Q: ${q}\nA: ${a}`).join('\n\n')
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
        store: false,
        reasoning: { effort: 'low' },
        max_output_tokens: 500,
        input: [
          { role: 'system', content: `You are Start Page Help for RPG Your Way. Answer only questions about starting a campaign, the Start page, basic beginner orientation, character import, and the choices documented below. Be concise, factual, and adult in tone. Do not pander. If the answer is not supported here, say that this helper does not know rather than guessing.\n\n${START_HELP_KNOWLEDGE}\n\nFAQ:\n${faq}` },
          { role: 'user', content: question },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    })
    const payload = await response.json() as OpenAIResponsePayload
    if (!response.ok) return NextResponse.json({ error: payload.error?.message || 'Start Page Help could not answer right now.' }, { status: response.status || 502 })
    const answer = outputText(payload)
    if (!answer) return NextResponse.json({ error: 'Start Page Help returned no answer.' }, { status: 502 })
    return NextResponse.json({ answer }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Start Page Help could not answer right now.' }, { status: 502 })
  }
}
