import { NextResponse } from 'next/server'
import { ADVANCEMENT_PROFILE_SCHEMA } from '@/lib/aigm/advancement-profile-schema'
import { isRateLimited } from '@/lib/aigm/rate-limit'
import type { CharacterAdvancementProfile } from '@/lib/aigm/campaign-storage'
import { billingErrorResponse, releaseUsage, requireUsageAccount, reserveUsage, settleUsage } from '@/lib/usage/server-billing'
import { estimateTerraMaximumMicrousd, terraProviderCostMicrousd } from '@/lib/usage/play-cost'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const DEFAULT_MODEL = 'gpt-5.6-terra'
const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_TEXT_CHARACTERS = 80_000
const MAX_READS_PER_HOUR = 20
const ONE_HOUR_MS = 60 * 60 * 1000
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'json', 'csv'])

interface OpenAIResponsePayload {
  id?: string
  output_text?: string
  output?: Array<{ content?: Array<{ type?: string; text?: string; refusal?: string }> }>
  usage?: unknown
  error?: { message?: string }
}

function jsonError(status: number, error: string, requestId: string, details?: string) {
  return NextResponse.json({ error, request_id: requestId, ...(details ? { details } : {}) }, { status })
}

function outputText(payload: OpenAIResponsePayload) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text
    }
  }
  return null
}

function refusalText(payload: OpenAIResponsePayload) {
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'refusal' && typeof content.refusal === 'string') return content.refusal
    }
  }
  return null
}

function extensionFor(filename: string) {
  return filename.toLocaleLowerCase().split('.').pop() ?? ''
}

function cleanProfile(value: CharacterAdvancementProfile, fallbackClass: string, fallbackRuleset: string, sourceName: string, profileKind: 'class' | 'subclass', subclassName: string): CharacterAdvancementProfile {
  const seen = new Set<number>()
  const levels = Array.isArray(value.levels)
    ? value.levels.flatMap((row) => {
        const level = Number.isFinite(row?.level) ? Math.max(1, Math.min(20, Math.round(row.level))) : 0
        if (!level || seen.has(level)) return []
        seen.add(level)
        return [{
          level,
          proficiency_bonus: typeof row.proficiency_bonus === 'string' ? row.proficiency_bonus.trim().slice(0, 30) : '',
          features: Array.isArray(row.features) ? row.features.map((item) => String(item).replace(/\s+/g, ' ').trim().slice(0, 160)).filter(Boolean).slice(0, 24) : [],
          feature_details: Array.isArray(row.feature_details) ? row.feature_details.flatMap((item) => {
            const name = typeof item?.name === 'string' ? item.name.replace(/\s+/g, ' ').trim().slice(0, 160) : ''
            const text = typeof item?.text === 'string' ? item.text.trim().slice(0, 6000) : ''
            return name && text ? [{ name, text }] : []
          }).slice(0, 24) : [],
          progression_values: Array.isArray(row.progression_values) ? row.progression_values.flatMap((item) => {
            const name = typeof item?.name === 'string' ? item.name.replace(/\s+/g, ' ').trim().slice(0, 100) : ''
            const shown = typeof item?.value === 'string' ? item.value.replace(/\s+/g, ' ').trim().slice(0, 100) : ''
            return name && shown ? [{ name, value: shown }] : []
          }).slice(0, 24) : [],
          spell_slots: Array.isArray(row.spell_slots) ? row.spell_slots.flatMap((item) => {
            const slotLevel = typeof item?.level === 'string' ? item.level.replace(/\s+/g, ' ').trim().slice(0, 30) : ''
            const total = typeof item?.total === 'string' ? item.total.replace(/\s+/g, ' ').trim().slice(0, 30) : ''
            return slotLevel && total ? [{ level: slotLevel, total }] : []
          }).slice(0, 12) : [],
        }]
      }).sort((a, b) => a.level - b.level)
    : []

  const suppliedHitPointDie = Number(value.hit_point_die)
  const hitPointDie = profileKind === 'class' && Number.isInteger(suppliedHitPointDie) && suppliedHitPointDie >= 2 && suppliedHitPointDie <= 100
    ? suppliedHitPointDie
    : undefined
  return {
    title: typeof value.title === 'string' && value.title.trim() ? value.title.trim().slice(0, 180) : `${fallbackClass || 'Character'} advancement`,
    class_name: typeof value.class_name === 'string' && value.class_name.trim() ? value.class_name.trim().slice(0, 120) : fallbackClass,
    ruleset: typeof value.ruleset === 'string' && value.ruleset.trim() ? value.ruleset.trim().slice(0, 140) : fallbackRuleset,
    source_name: sourceName.slice(0, 180),
    profile_kind: profileKind,
    subclass_name: profileKind === 'subclass' ? subclassName.slice(0, 140) : '',
    ...(hitPointDie ? { hit_point_die: hitPointDie } : {}),
    levels,
    warnings: Array.isArray(value.warnings) ? value.warnings.map((item) => String(item).replace(/\s+/g, ' ').trim().slice(0, 260)).filter(Boolean).slice(0, 20) : [],
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID()
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return jsonError(503, 'The AIGM connection is not configured yet.', requestId)
  if (isRateLimited(request, 'advancement-profile', MAX_READS_PER_HOUR, ONE_HOUR_MS)) {
    return jsonError(429, 'Too many advancement charts have been read from this connection. Wait before trying again.', requestId)
  }

  let usageAccount
  try {
    usageAccount = await requireUsageAccount()
  } catch (error) {
    return billingErrorResponse(error)
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return jsonError(400, 'The advancement information could not be read.', requestId)
  }

  const className = typeof formData.get('class_name') === 'string' ? String(formData.get('class_name')).trim().slice(0, 120) : ''
  const ruleset = typeof formData.get('ruleset') === 'string' ? String(formData.get('ruleset')).trim().slice(0, 140) : ''
  const profileKind = formData.get('profile_kind') === 'subclass' ? 'subclass' : 'class'
  const subclassName = typeof formData.get('subclass_name') === 'string' ? String(formData.get('subclass_name')).trim().slice(0, 140) : ''
  if (profileKind === 'subclass' && !subclassName) return jsonError(400, 'Name the subclass before adding its advancement chart.', requestId)
  const pastedText = typeof formData.get('pasted_text') === 'string' ? String(formData.get('pasted_text')).trim() : ''
  const upload = formData.get('file')
  if (!pastedText && !(upload instanceof File)) {
    return jsonError(400, 'Add a screenshot, PDF, or pasted advancement chart first.', requestId)
  }
  if (pastedText.length > MAX_TEXT_CHARACTERS) return jsonError(413, 'Pasted advancement information is too large.', requestId)
  if (upload instanceof File && upload.size > MAX_FILE_BYTES) return jsonError(413, 'The advancement file is larger than the 10 MB limit.', requestId)

  const content: Array<Record<string, unknown>> = []
  let sourceName = pastedText ? 'Pasted advancement information' : upload instanceof File ? upload.name : 'Advancement information'
  if (upload instanceof File && upload.size > 0) {
    const extension = extensionFor(upload.name)
    const buffer = Buffer.from(await upload.arrayBuffer())
    if (IMAGE_TYPES.has(upload.type) || ['png', 'jpg', 'jpeg', 'webp'].includes(extension)) {
      const mime = IMAGE_TYPES.has(upload.type) ? upload.type : extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg'
      content.push({
        type: 'input_image',
        image_url: `data:${mime};base64,${buffer.toString('base64')}`,
        detail: 'high',
      })
    } else if (upload.type === 'application/pdf' || extension === 'pdf') {
      content.push({
        type: 'input_file',
        filename: upload.name,
        file_data: `data:application/pdf;base64,${buffer.toString('base64')}`,
      })
    } else if (TEXT_EXTENSIONS.has(extension) || upload.type.startsWith('text/')) {
      const text = buffer.toString('utf8').replace(/^\uFEFF/, '').trim()
      if (!text) return jsonError(400, 'The selected advancement file is empty.', requestId)
      if (text.length > MAX_TEXT_CHARACTERS) return jsonError(413, 'The advancement text is too large.', requestId)
      content.push({ type: 'input_text', text: `SOURCE FILE: ${upload.name}\n\n${text}` })
    } else {
      return jsonError(415, 'Use a screenshot, PNG, JPEG, WebP, PDF, TXT, Markdown, JSON, or CSV advancement chart.', requestId)
    }
  }
  if (pastedText) content.push({ type: 'input_text', text: `PASTED ADVANCEMENT INFORMATION:\n${pastedText}` })

  content.push({
    type: 'input_text',
    text: profileKind === 'subclass'
      ? `Extract the level-by-level subclass advancement structure for ${subclassName} (${className || 'character class'}) under ${ruleset || 'the player-selected ruleset'}. Capture subclass feature NAMES, compact numeric progression columns, and granted spell names shown in the player-supplied source. For each named non-spell feature whose operative rules text is actually visible in the supplied source, also put that character-relevant rules text in feature_details as { name, text }. Keep the text faithful and sufficient to run the feature, but do not invent anything that is not visible. Do not copy spell descriptions, general setting prose, or unrelated sourcebook text. Subclass profiles do not define the class Hit Point Die, so set hit_point_die to 0. Preserve the chart's labels. Use an empty array or a warning when feature rules cannot be read confidently rather than guessing. Include every visible subclass level from 1 through 20 when present.`
      : `Extract the level-by-level advancement structure for ${className || 'this character class'} under ${ruleset || 'the player-selected ruleset'}. Capture feature NAMES, proficiency bonus, numeric progression columns (for example plans known, cantrips, prepared spells, magic items, rage uses, sneak attack dice), spell-slot totals, and the class Hit Point Die when the supplied material explicitly shows it. For each named non-spell feature whose operative rules text is actually visible in the player-supplied source, also put that character-relevant rules text in feature_details as { name, text }. Keep the text faithful and sufficient to run the feature, but do not invent anything that is not visible. Do not copy spell descriptions, general setting prose, or unrelated sourcebook text. Put the die size as an integer such as 8; use 0 when the source does not show it. Preserve the chart's labels. Use an empty array or a warning when feature rules cannot be read confidently rather than guessing. Include every visible level from 1 through 20 when present.`,
  })

  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL
  let reservation
  try {
    const sourceCharacters = pastedText.length + (upload instanceof File ? Math.min(upload.size, 1_500_000) : 0) + 45_000
    reservation = await reserveUsage(usageAccount, {
      maximumMicrousd: estimateTerraMaximumMicrousd(sourceCharacters, 9_000, 1.7, 20),
      feature: 'advancement-profile',
      sourceRef: `${profileKind}:${profileKind === 'subclass' ? subclassName : className || 'character'}`,
      operationId: request.headers.get('x-rpgyw-operation-id') || requestId,
    })
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: 'medium' },
        max_output_tokens: 9000,
        input: [
          {
            role: 'system',
            content: [{
              type: 'input_text',
              text: 'You are extracting a compact private class or subclass advancement record for RPG Your Way. Return only facts visible in the supplied material. Preserve each non-spell feature name and the operative feature text visible in the player-supplied source together in feature_details so the character can use it during play. Do not copy spell descriptions, setting prose, or unrelated sourcebook text. Never invent missing rows or values, and never invent rules.',
            }],
          },
          { role: 'user', content },
        ],
        text: { format: { type: 'json_schema', name: 'aigm_advancement_profile_1_0', strict: true, schema: ADVANCEMENT_PROFILE_SCHEMA } },
      }),
      signal: AbortSignal.timeout(110_000),
    })
    const payload = (await response.json()) as OpenAIResponsePayload
    if (!response.ok) {
      console.error('Advancement profile read failed', { requestId, status: response.status, error: payload.error })
      await releaseUsage(reservation, { model, metadata: { status: response.status, reason: 'provider_error' } })
      return jsonError(502, 'RPG Your Way had a temporary problem reading that advancement chart.', requestId, 'Nothing was saved. Try the same chart again.')
    }
    const refusal = refusalText(payload)
    if (refusal) {
      await releaseUsage(reservation, { model, metadata: { reason: 'refusal' } })
      return jsonError(422, 'RPG Your Way could not use that advancement chart.', requestId, 'Try a clearer crop or paste the progression table as text.')
    }
    const text = outputText(payload)
    if (!text) {
      await releaseUsage(reservation, { model, metadata: { reason: 'empty_output' } })
      return jsonError(502, 'The AIGM returned no readable advancement chart.', requestId)
    }
    let parsed: CharacterAdvancementProfile
    try {
      parsed = JSON.parse(text) as CharacterAdvancementProfile
    } catch {
      await releaseUsage(reservation, { model, metadata: { reason: 'invalid_json' } })
      return jsonError(502, 'The advancement chart came back in an unreadable format.', requestId)
    }
    const profile = cleanProfile(parsed, className, ruleset, sourceName, profileKind, subclassName)
    if (profile.levels.length === 0) {
      await releaseUsage(reservation, { model, metadata: { reason: 'no_rows' } })
      return jsonError(422, 'No level-by-level advancement rows were found.', requestId, 'Try a screenshot that includes the level column and progression headings.')
    }
    const billing = await settleUsage(reservation, {
      model,
      providerCostMicrousd: terraProviderCostMicrousd(payload),
      metadata: { request_id: payload.id || response.headers.get('x-request-id') || requestId },
    })
    return NextResponse.json({
      profile,
      model,
      request_id: payload.id || requestId,
      usage_billing: {
        billed_microusd: billing.billedMicrousd,
        balance_microusd: billing.balanceMicrousd,
        owner_qa_exempt: billing.ownerQaExempt,
        settlement_warning: billing.settlementWarning,
      },
    })
  } catch (error) {
    if (reservation) await releaseUsage(reservation, { model, metadata: { reason: 'request_failure' } })
    if (error instanceof Error && error.name === 'UsageBillingError') return billingErrorResponse(error)
    console.error('Advancement profile request failed', { requestId, error })
    return jsonError(502, 'RPG Your Way could not reach the advancement reader.', requestId, 'Nothing was saved. Try again.')
  }
}
