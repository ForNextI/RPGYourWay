import { estimateShapeMaximumMicrousd } from '@/lib/shape/billing'
import { SHAPE_MAX_INPUT_CHARACTERS, normalizeShapeTranscriptForFingerprint } from '@/lib/shape/transcript'
import { createClient } from '@/lib/supabase/server'
import { formatUsageDollars } from '@/lib/usage/money'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return Response.json({ error: 'Sign in before using Script.' }, { status: 401 })

  let body: { transcript?: unknown; project_mode?: unknown }
  try { body = await request.json() } catch { return Response.json({ error: 'Script could not read that estimate request.' }, { status: 400 }) }
  const transcript = typeof body.transcript === 'string' ? normalizeShapeTranscriptForFingerprint(body.transcript) : ''
  if (transcript.length < 250) return Response.json({ error: 'Give Script at least 250 characters before estimating usage.' }, { status: 400 })
  if (transcript.length > SHAPE_MAX_INPUT_CHARACTERS) return Response.json({ error: 'This transcript is too large for one Script request.' }, { status: 400 })

  try {
    const maximumMicrousd = estimateShapeMaximumMicrousd(transcript, body.project_mode === true)
    return Response.json({
      maximum_microusd: maximumMicrousd,
      maximum_display: formatUsageDollars(maximumMicrousd),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (caught) {
    return Response.json({ error: caught instanceof Error ? caught.message : 'Script could not estimate this request.' }, { status: 400 })
  }
}
