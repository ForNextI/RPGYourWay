import { NextResponse } from 'next/server'
import { isRateLimited } from '@/lib/aigm/rate-limit'
import { dnd55SpellDetail } from '@/lib/aigm/srd-record-details'
import { billingErrorResponse, requireUsageAccount } from '@/lib/usage/server-billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_LOOKUPS_PER_HOUR = 240
const ONE_HOUR_MS = 60 * 60 * 1000

interface RulesDetailBody {
  kind?: string
  name?: string
  ruleset?: string
}

export async function POST(request: Request) {
  try {
    await requireUsageAccount()
  } catch (error) {
    return billingErrorResponse(error)
  }
  if (isRateLimited(request, 'rules-detail', MAX_LOOKUPS_PER_HOUR, ONE_HOUR_MS)) {
    return NextResponse.json({ error: 'Too many rules-reference lookups from this connection. Wait before trying again.' }, { status: 429 })
  }
  let body: RulesDetailBody
  try { body = await request.json() as RulesDetailBody } catch {
    return NextResponse.json({ error: 'The rules-reference request could not be read.' }, { status: 400 })
  }
  const name = typeof body.name === 'string' ? body.name.replace(/\s+/g, ' ').trim().slice(0, 160) : ''
  const ruleset = typeof body.ruleset === 'string' ? body.ruleset : ''
  if (body.kind !== 'spell' || !name) return NextResponse.json({ error: 'Choose a spell to look up.' }, { status: 400 })
  if (!/(?:5\.5e|2024)/i.test(ruleset)) return NextResponse.json({ detail: null }, { headers: { 'Cache-Control': 'private, max-age=3600' } })
  const detail = dnd55SpellDetail(name)
  return NextResponse.json({ detail }, { headers: { 'Cache-Control': 'private, max-age=86400' } })
}
