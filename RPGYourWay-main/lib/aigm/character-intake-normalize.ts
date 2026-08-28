import { cleanSubclass } from '@/lib/aigm/character-display'
import { canonicalizeCharacterRecord, characterFeatureEntries, characterProficiencies } from '@/lib/aigm/character-record'
import type {
  AttackEntry,
  CharacterIntakeResult,
  ClarificationQuestion,
  IntakeIssue,
} from '@/lib/aigm/types'



const CHECKBOX_TOKEN = /\[(?:\s|x|X|✓|✔)?\]|[☐☑☒]/g
const LATER_RECORD_SECTION = /^(?:senses?(?: and defenses?)?|languages?|attacks?(?: and weapons?)?|selected weapon masteries|armor(?: and shields?)?|equipment|coins?|attuned items?|limited-use resources?|spellcasting ability|spell save dc|spell attack bonus|spell slots?|spells?|cantrips?|features?(?: and abilities)?|personality traits?|ideals?|bonds?|flaws?|allies?(?: and organizations?)?|character notes?|background summary|backstory|appearance|homebrew(?: or unusual rules)?)\s*:?$/i

function checkboxStats(value: string) {
  const tokens = value.match(CHECKBOX_TOKEN) ?? []
  const checked = tokens.filter((token) => /x|X|✓|✔|☑|☒/.test(token)).length
  return { total: tokens.length, checked }
}

/** Converts printable sheet checkboxes into readable data instead of literal boxes. */
export function normalizePrintableCheckboxes(value: string) {
  if (!value || !CHECKBOX_TOKEN.test(value)) {
    CHECKBOX_TOKEN.lastIndex = 0
    return value
  }
  CHECKBOX_TOKEN.lastIndex = 0
  const { total, checked } = checkboxStats(value)
  CHECKBOX_TOKEN.lastIndex = 0
  const remaining = value.replace(CHECKBOX_TOKEN, ' ').replace(/\s+/g, ' ').trim()
  CHECKBOX_TOKEN.lastIndex = 0
  if (!remaining) return `${checked}/${total}`
  if (/\b(?:total|used|available|remaining|uses?)\b/i.test(remaining)) return remaining
  if (total === 1) return checked > 0 ? `${remaining} (selected)` : remaining
  return `${remaining} (${checked}/${total} marked)`
}

export function cleanMechanicRows(items: string[]) {
  const clean: string[] = []
  for (const raw of items ?? []) {
    const value = normalizePrintableCheckboxes(typeof raw === 'string' ? raw.trim() : '')
    if (!value) continue
    if (LATER_RECORD_SECTION.test(value)) break
    clean.push(value)
  }
  return clean
}

function nonnegativeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0
}

function parseCurrencyText(values: string[]) {
  const combined = values.join('\n')
  const coin = (denomination: string) => {
    const match = combined.match(new RegExp(`(?:^|[^A-Z0-9.])(\\d+(?:\\.\\d+)?)\\s*${denomination}\\b`, 'i'))
    return match ? Math.max(0, Number(match[1])) : 0
  }
  return { cp: coin('CP'), sp: coin('SP'), ep: coin('EP'), gp: coin('GP'), pp: coin('PP') }
}

function normalizeCurrency(result: CharacterIntakeResult) {
  const supplied = result.character.currency
  const inferred = parseCurrencyText([
    ...(result.additional_details ?? []),
    ...(result.sheet_summary ?? []),
    ...(result.character.equipment_highlights ?? []).flatMap((entry) => [entry.name, entry.quantity, entry.sheet_status]),
    ...(result.character.skills ?? []),
  ])
  const currency = {
    cp: nonnegativeNumber(supplied?.cp ?? inferred.cp),
    sp: nonnegativeNumber(supplied?.sp ?? inferred.sp),
    ep: nonnegativeNumber(supplied?.ep ?? inferred.ep),
    gp: nonnegativeNumber(supplied?.gp ?? inferred.gp),
    pp: nonnegativeNumber(supplied?.pp ?? inferred.pp),
    total_gp_value: 0,
  }
  currency.total_gp_value = Number((currency.cp / 100 + currency.sp / 10 + currency.ep / 2 + currency.gp + currency.pp * 10).toFixed(2))
  return currency
}

function normalizeValuables(result: CharacterIntakeResult) {
  return Array.isArray(result.character.valuables)
    ? result.character.valuables.slice(0, 80).map((entry) => ({
      name: typeof entry?.name === 'string' ? entry.name.trim() : '',
      quantity: typeof entry?.quantity === 'string' ? normalizePrintableCheckboxes(entry.quantity.trim()) : '',
      value_each_gp: typeof entry?.value_each_gp === 'string' ? entry.value_each_gp.trim() : '',
      estimated_total_gp: typeof entry?.estimated_total_gp === 'string' ? entry.estimated_total_gp.trim() : '',
    })).filter((entry) => entry.name)
    : []
}

function abilityModifier(score: number) {
  return Math.floor((score - 10) / 2)
}

function parseSignedNumber(value: string) {
  const match = value.match(/[+-]?\d+/)
  return match ? Number.parseInt(match[0], 10) : 0
}

function formatSigned(value: number) {
  return value >= 0 ? `+${value}` : String(value)
}

function hasAlertInitiativeBonus(result: CharacterIntakeResult) {
  return characterFeatureEntries(result).some((feature) => /\bAlert\b/i.test(feature.name))
}

/**
 * Returns a safe initiative modifier for both new 1.4 records and older
 * browser-saved records that predate the initiative field.
 */
export function getInitiativeModifier(result: CharacterIntakeResult) {
  const recorded = result.character.initiative_modifier
  if (typeof recorded === 'number' && Number.isFinite(recorded)) return recorded

  const dexterityModifier = abilityModifier(result.character.ability_scores.dexterity)
  const proficiencyBonus = parseSignedNumber(result.character.proficiency_bonus)
  return dexterityModifier + (hasAlertInitiativeBonus(result) ? proficiencyBonus : 0)
}

function normalizedAttackName(attack: AttackEntry) {
  return attack.name
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasQuarterstaffProficiency(result: CharacterIntakeResult) {
  const featureSaysSimpleWeapons = characterFeatureEntries(result).some((feature) =>
    /simple weapons? proficiency|proficiency with simple weapons?/i.test(`${feature.name} ${feature.detail}`),
  ) || characterProficiencies(result).weapons.some((entry) => /simple weapons?/i.test(entry))

  if (featureSaysSimpleWeapons) return true

  return result.character.classes.some((entry) =>
    /^(wizard|sorcerer)$/i.test(entry.name.trim()),
  )
}

function hasAlternativeQuarterstaffAbility(attack: AttackEntry) {
  return attack.properties.some((property) =>
    /shillelagh|spellcasting ability|pact weapon|finesse/i.test(property),
  )
}

const REVIEW_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'before', 'but', 'by', 'can', 'character',
  'does', 'for', 'from', 'has', 'have', 'how', 'if', 'in', 'is', 'it', 'its', 'may',
  'of', 'on', 'or', 'please', 'sheet', 'should', 'that', 'the', 'their', 'this', 'to',
  'what', 'when', 'which', 'with', 'you', 'your',
])

function reviewTokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 1 && !REVIEW_STOP_WORDS.has(token)),
  )
}

function normalizedReviewText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function substantiallyOverlaps(left: string, right: string) {
  const normalizedLeft = normalizedReviewText(left)
  const normalizedRight = normalizedReviewText(right)
  if (!normalizedLeft || !normalizedRight) return false
  if (normalizedLeft === normalizedRight) return true
  if (normalizedLeft.length >= 18 && normalizedRight.includes(normalizedLeft)) return true
  if (normalizedRight.length >= 18 && normalizedLeft.includes(normalizedRight)) return true

  const leftTokens = reviewTokens(left)
  const rightTokens = reviewTokens(right)
  if (leftTokens.size === 0 || rightTokens.size === 0) return false

  let intersection = 0
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) intersection += 1
  })

  const smaller = Math.min(leftTokens.size, rightTokens.size)
  return intersection >= 3 && intersection / smaller >= 0.6
}

function uniqueQuestions(questions: ClarificationQuestion[]) {
  const priorityRank: Record<ClarificationQuestion['priority'], number> = {
    required: 3,
    important: 2,
    optional: 1,
  }
  const seen: string[] = []

  // When the model returns the same matter at two priorities, keep the higher
  // priority once. This prevents a required question from also appearing as a
  // yellow or optional question merely because it was listed first.
  return [...questions]
    .sort((left, right) => priorityRank[right.priority] - priorityRank[left.priority])
    .filter((question) => {
      const text = `${question.question} ${question.reason}`
      if (seen.some((prior) => substantiallyOverlaps(prior, text))) return false
      seen.push(text)
      return true
    })
}

function uniqueIssues(issues: IntakeIssue[]) {
  const seen: string[] = []
  return issues.filter((issue) => {
    const text = `${issue.category} ${issue.issue} ${issue.why_it_matters}`
    if (seen.some((prior) => substantiallyOverlaps(prior, text))) return false
    seen.push(text)
    return true
  })
}

function removeQuestionDuplicatesFromIssues(
  issues: IntakeIssue[],
  questions: ClarificationQuestion[],
) {
  return issues.filter((issue) => {
    const issueText = `${issue.category} ${issue.issue} ${issue.why_it_matters}`
    return !questions.some((question) => substantiallyOverlaps(
      issueText,
      `${question.question} ${question.reason}`,
    ))
  })
}

/**
 * Applies deterministic guardrails after every model response and whenever an
 * older browser-saved record is reopened.
 */
export function normalizeCharacterIntakeResult(
  result: CharacterIntakeResult,
): CharacterIntakeResult {
  const proficiencyBonus = parseSignedNumber(result.character.proficiency_bonus)
  const strengthModifier = abilityModifier(result.character.ability_scores.strength)

  const attacks = result.character.attacks.map((attack) => {
    if (normalizedAttackName(attack) !== 'quarterstaff') return attack
    if (!hasQuarterstaffProficiency(result) || hasAlternativeQuarterstaffAbility(attack)) return attack

    return {
      ...attack,
      attack_bonus: formatSigned(strengthModifier + proficiencyBonus),
    }
  })

  const clarificationQuestions = uniqueQuestions(result.clarification_questions ?? [])
  const detectedIssues = removeQuestionDuplicatesFromIssues(
    uniqueIssues(result.detected_issues ?? []),
    clarificationQuestions,
  )

  const normalized: CharacterIntakeResult = {
    ...result,
    intake_settings: {
      campaign_start_mode: result.intake_settings?.campaign_start_mode === 'continuing' ? 'continuing' : 'new_fully_rested',
      dont_sweat_small_stuff: result.intake_settings?.dont_sweat_small_stuff !== false,
      ruleset: typeof result.intake_settings?.ruleset === 'string' && result.intake_settings.ruleset.trim()
        ? result.intake_settings.ruleset.trim()
        : 'D&D 5.5e (2024 rules)',
    },
    document_assessment: result.document_assessment ?? {
      kind: 'dnd_beyond_character_sheet',
      is_usable: true,
      reason: 'Previously saved intake record.',
    },
    detected_issues: detectedIssues,
    additional_details: Array.isArray(result.additional_details) ? result.additional_details.filter((entry) => typeof entry === 'string' && entry.trim()).map((entry) => entry.trim()) : [],
    clarification_questions: clarificationQuestions,
    character: {
      ...result.character,
      is_current_party_active_leader: result.character.is_current_party_active_leader === true,
      sex: typeof result.character.sex === 'string' ? result.character.sex : '',
      pronouns: typeof result.character.pronouns === 'string' ? result.character.pronouns : '',
      age: typeof result.character.age === 'string' ? result.character.age : '',
      alignment: typeof result.character.alignment === 'string' ? result.character.alignment : '',
      classes: (result.character.classes ?? []).map((entry) => ({
        ...entry,
        subclass: cleanSubclass(entry.subclass),
      })),
      initiative_modifier: getInitiativeModifier(result),
      saving_throws: cleanMechanicRows(result.character.saving_throws ?? []),
      skills: cleanMechanicRows(result.character.skills ?? []),
      currency: normalizeCurrency(result),
      valuables: normalizeValuables(result),
      attacks,
    },
  }
  return canonicalizeCharacterRecord(normalized)
}
