import { NextResponse } from 'next/server'
import { enrichFromSavedCharacterRules } from '@/lib/aigm/saved-record-details'
import { enrichDnd55CharacterRecord } from '@/lib/aigm/srd-record-details'
import type { CharacterIntakeResult } from '@/lib/aigm/types'
import { billingErrorResponse, requireUsageAccount } from '@/lib/usage/server-billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_CHARACTERS = 1_500_000

interface MigrationBody {
  characters?: Array<{
    id?: string
    result?: CharacterIntakeResult
    advancement_profiles?: unknown
  }>
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID()
  try {
    await requireUsageAccount()
  } catch (error) {
    return billingErrorResponse(error)
  }
  let body: MigrationBody
  try {
    const source = await request.text()
    if (source.length > MAX_BODY_CHARACTERS) {
      return NextResponse.json({ error: 'The character-record migration request is too large.', request_id: requestId }, { status: 413 })
    }
    body = JSON.parse(source) as MigrationBody
  } catch {
    return NextResponse.json({ error: 'The character-record migration request could not be read.', request_id: requestId }, { status: 400 })
  }

  if (!Array.isArray(body.characters) || body.characters.length > 6) {
    return NextResponse.json({ error: 'Character-record migration accepts a party of up to six characters.', request_id: requestId }, { status: 400 })
  }

  const characters = body.characters.flatMap((entry) => {
    const id = typeof entry?.id === 'string' ? entry.id.trim().slice(0, 100) : ''
    if (!id || !entry?.result || typeof entry.result !== 'object') return []
    const savedRules = enrichFromSavedCharacterRules(entry.result, entry.advancement_profiles)
    const srdRules = enrichDnd55CharacterRecord(savedRules.result)
    return [{ id, result: srdRules.result }]
  })

  return NextResponse.json({ characters, request_id: requestId }, { headers: { 'Cache-Control': 'no-store' } })
}
