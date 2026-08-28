import { NextResponse } from 'next/server'
import { isRateLimited } from '@/lib/aigm/rate-limit'
import { selectedRulesetFromSetupAnswers } from '@/lib/aigm/supported-systems'
import { builtInSubclassFeatureNamesAtLevel, builtInSubclassForClass, classLevelUsesSubclass, formatRulesReference, hitPointDieForClass, levelUpSpellGuidanceForClass, rulesReferenceFor, rulesReferenceForClassAdvancement, srdSpellCatalogForClass } from '@/lib/aigm/rules-library'
import { dnd55CanDeterministicallyCombineSpellSlots, dnd55ClassMetadata, dnd55CombinedSpellSlots, dnd55PrerequisiteFailures, dnd55UnverifiedPrerequisiteClasses, dnd55UnverifiedSpellSlotSources, proficiencyBonusForTotalLevel } from '@/lib/aigm/multiclassing'
import { LEVEL_UP_PLAN_SCHEMA } from '@/lib/aigm/level-up-schema'
import type { CharacterAdvancementProfile } from '@/lib/aigm/campaign-storage'
import type { LevelUpChoiceKind, LevelUpPlan } from '@/lib/aigm/level-up'
import type { CharacterIntakeResult } from '@/lib/aigm/types'
import { characterFeatureEntries } from '@/lib/aigm/character-record'
import { billingErrorResponse, releaseUsage, requireUsageAccount, reserveUsage, settleUsage } from '@/lib/usage/server-billing'
import { estimateTerraMaximumMicrousd, terraProviderCostMicrousd } from '@/lib/usage/play-cost'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const DEFAULT_MODEL = 'gpt-5.6-terra'
const MAX_PLANS_PER_HOUR = 30
const ONE_HOUR_MS = 60 * 60 * 1000

interface LevelUpBody {
  current_result?: CharacterIntakeResult
  setup_answers?: string[]
  advancement_profile?: CharacterAdvancementProfile | null
  subclass_advancement_profile?: CharacterAdvancementProfile | null
  advancing_class?: string
  selected_subclass?: string
  taking_new_class?: boolean
  multiclass_prerequisite_confirmed?: boolean
}

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

function looksLikeCharacterResult(value: unknown): value is CharacterIntakeResult {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<CharacterIntakeResult>
  return Boolean(item.character && Array.isArray(item.character.classes) && typeof item.character.total_level === 'number')
}

function cleanStrings(value: unknown, maximumItems: number, maximumLength: number) {
  return Array.isArray(value)
    ? value.map((entry) => typeof entry === 'string' ? entry.replace(/\s+/g, ' ').trim().slice(0, maximumLength) : '').filter(Boolean).slice(0, maximumItems)
    : []
}

function cleanPlan(value: LevelUpPlan, fallbackClass: string, targetTotalLevel: number, targetClassLevel: number): LevelUpPlan {
  const sourceKind = value.source_kind === 'supported_srd' || value.source_kind === 'player_profile' ? value.source_kind : 'needs_profile'
  const choices = Array.isArray(value.choices) ? value.choices.flatMap((choice, index) => {
    const label = typeof choice?.label === 'string' ? choice.label.replace(/\s+/g, ' ').trim().slice(0, 160) : ''
    if (!label) return []
    const id = typeof choice.id === 'string' && choice.id.trim() ? choice.id.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80) : `choice-${index + 1}`
    const help = typeof choice.help === 'string' ? choice.help.replace(/\s+/g, ' ').trim().slice(0, 320) : ''
    const suppliedKind = choice.choice_kind
    const choiceKind: LevelUpChoiceKind = suppliedKind === 'spellbook' || suppliedKind === 'prepared_spell' || suppliedKind === 'known_spell' || suppliedKind === 'cantrip' ? suppliedKind : 'other'
    const suppliedCount = Number(choice.selection_count)
    const selectionCount = Number.isInteger(suppliedCount) && suppliedCount >= 1 && suppliedCount <= 20 ? suppliedCount : 1
    return [{
      id,
      label,
      help,
      required: Boolean(choice.required),
      options: cleanStrings(choice.options, 24, 120),
      choice_kind: choiceKind,
      selection_count: selectionCount,
    }]
  }).slice(0, 16) : []
  return {
    can_proceed: Boolean(value.can_proceed) && sourceKind !== 'needs_profile',
    needs_advancement_profile: sourceKind === 'needs_profile' || Boolean(value.needs_advancement_profile),
    source_kind: sourceKind,
    source_label: typeof value.source_label === 'string' ? value.source_label.replace(/\s+/g, ' ').trim().slice(0, 180) : '',
    advancing_class: typeof value.advancing_class === 'string' && value.advancing_class.trim() ? value.advancing_class.trim().slice(0, 120) : fallbackClass,
    target_total_level: targetTotalLevel,
    target_class_level: targetClassLevel,
    proficiency_bonus: typeof value.proficiency_bonus === 'string' ? value.proficiency_bonus.trim().slice(0, 30) : '',
    automatic_changes: cleanStrings(value.automatic_changes, 30, 220),
    feature_names: cleanStrings(value.feature_names, 24, 160),
    progression_values: Array.isArray(value.progression_values) ? value.progression_values.flatMap((entry) => {
      const name = typeof entry?.name === 'string' ? entry.name.replace(/\s+/g, ' ').trim().slice(0, 100) : ''
      const shown = typeof entry?.value === 'string' ? entry.value.replace(/\s+/g, ' ').trim().slice(0, 100) : ''
      return name && shown ? [{ name, value: shown }] : []
    }).slice(0, 24) : [],
    spell_slots: Array.isArray(value.spell_slots) ? value.spell_slots.flatMap((entry) => {
      const level = typeof entry?.level === 'string' ? entry.level.replace(/\s+/g, ' ').trim().slice(0, 30) : ''
      const total = typeof entry?.total === 'string' ? entry.total.replace(/\s+/g, ' ').trim().slice(0, 30) : ''
      return level && total ? [{ level, total }] : []
    }).slice(0, 12) : [],
    choices,
    warnings: cleanStrings(value.warnings, 20, 260),
  }
}

function numericSpellLevel(value: string) {
  const match = value.match(/(?:level\s*)?(\d+)/i)
  const level = match ? Number(match[1]) : 0
  return Number.isFinite(level) && level >= 1 && level <= 9 ? level : 0
}

function maximumSpellLevel(plan: LevelUpPlan) {
  const fromSlots = plan.spell_slots.reduce((maximum, entry) => Math.max(maximum, numericSpellLevel(entry.level)), 0)
  if (fromSlots > 0) return fromSlots
  for (const entry of plan.progression_values) {
    if (!/spell.*slot.*level|slot.*level/i.test(entry.name)) continue
    const level = numericSpellLevel(entry.value)
    if (level > 0) return level
  }
  return 0
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID()
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return jsonError(503, 'The AIGM connection is not configured yet.', requestId)
  if (isRateLimited(request, 'level-up-plan', MAX_PLANS_PER_HOUR, ONE_HOUR_MS)) {
    return jsonError(429, 'Too many level-up plans have been requested from this connection. Wait before trying again.', requestId)
  }

  let body: LevelUpBody
  try {
    body = (await request.json()) as LevelUpBody
  } catch {
    return jsonError(400, 'The level-up request could not be read.', requestId)
  }
  if (!looksLikeCharacterResult(body.current_result)) return jsonError(400, 'The current character record is missing or unreadable.', requestId)
  let usageAccount
  try {
    usageAccount = await requireUsageAccount()
  } catch (error) {
    return billingErrorResponse(error)
  }
  const current = body.current_result
  if (current.character.total_level >= 20) return jsonError(400, 'This character is already level 20.', requestId)
  const classes = current.character.classes.filter((entry) => entry.name.trim())
  if (classes.length === 0) return jsonError(400, 'The character record does not identify a class to advance.', requestId)
  const requestedClass = typeof body.advancing_class === 'string' ? body.advancing_class.trim() : ''
  const takingNewClass = body.taking_new_class === true
  const existingClass = classes.find((entry) => entry.name.toLocaleLowerCase() === requestedClass.toLocaleLowerCase()) ?? null
  if (!requestedClass) return jsonError(400, 'Choose which class is gaining the level.', requestId)
  if (takingNewClass && existingClass) return jsonError(400, `${existingClass.name} is already one of this character’s classes. Advance that class instead.`, requestId)
  const classEntry = takingNewClass ? { name: requestedClass, level: 0, subclass: '' } : (existingClass ?? (classes.length === 1 ? classes[0] : null))
  if (!classEntry) return jsonError(400, 'Choose which class is gaining the level.', requestId)

  const targetTotalLevel = Math.min(20, current.character.total_level + 1)
  const targetClassLevel = takingNewClass ? 1 : Math.min(20, classEntry.level + 1)
  const setupAnswers = Array.isArray(body.setup_answers) ? body.setup_answers.filter((entry): entry is string => typeof entry === 'string') : []
  const selectedRuleset = selectedRulesetFromSetupAnswers(setupAnswers)
  if (takingNewClass && selectedRuleset.id === 'dnd-5.5e-srd-5.2.1') {
    const failures = dnd55PrerequisiteFailures(classes, classEntry.name, current.character.ability_scores)
    if (failures.length > 0) return jsonError(400, `This character does not meet the D&D 5.5e multiclass prerequisites. ${failures.join(' ')}`, requestId)
    const unverified = dnd55UnverifiedPrerequisiteClasses(classes, classEntry.name)
    if (unverified.length > 0 && body.multiclass_prerequisite_confirmed !== true) {
      return jsonError(400, `RPG Your Way cannot verify the multiclass primary-ability prerequisite for ${unverified.join(', ')} from its built-in SRD. Confirm that you checked those class prerequisites in your source before continuing.`, requestId)
    }
  }
  const profile = body.advancement_profile && Array.isArray(body.advancement_profile.levels) ? body.advancement_profile : null
  const profileRow = profile?.levels.find((row) => row.level === targetClassLevel) ?? null
  const previousProfileRow = profile?.levels.find((row) => row.level === classEntry.level) ?? null
  const rulesReference = selectedRuleset.builtIn
    ? rulesReferenceForClassAdvancement(selectedRuleset, classEntry.name, targetClassLevel)
    : null
  const multiclassRelevant = selectedRuleset.id === 'dnd-5.5e-srd-5.2.1' && (takingNewClass || classes.length > 1)
  const multiclassReference = multiclassRelevant
    ? rulesReferenceFor(selectedRuleset, `Multiclassing prerequisites hit points hit dice proficiency bonus proficiencies class features armor class extra attack spellcasting ${classEntry.name}`, 10_000)
    : null
  const requestedSubclass = typeof body.selected_subclass === 'string' ? body.selected_subclass.replace(/\s+/g, ' ').trim().slice(0, 140) : ''
  const currentSubclass = classEntry.subclass.replace(/\s+/g, ' ').trim()
  const selectedSubclass = requestedSubclass || currentSubclass
  const builtInSubclass = builtInSubclassForClass(selectedRuleset, classEntry.name)
  const profileSignalsSubclass = Boolean(profileRow?.features.some((feature) => /\b(?:subclass|archetype)\b/i.test(feature)))
  const subclassRelevantAtTarget = classLevelUsesSubclass(selectedRuleset, classEntry.name, targetClassLevel) || profileSignalsSubclass
  const subclassProfile = body.subclass_advancement_profile && Array.isArray(body.subclass_advancement_profile.levels)
    ? body.subclass_advancement_profile
    : null
  const subclassProfileMatches = Boolean(subclassProfile
    && subclassProfile.class_name.trim().toLocaleLowerCase() === classEntry.name.trim().toLocaleLowerCase()
    && (subclassProfile.subclass_name || '').trim().toLocaleLowerCase() === selectedSubclass.toLocaleLowerCase())
  const subclassProfileRow = subclassProfileMatches ? (subclassProfile?.levels.find((row) => row.level === targetClassLevel) ?? null) : null
  const selectedSubclassIsBuiltIn = Boolean(selectedSubclass && builtInSubclass && selectedSubclass.toLocaleLowerCase() === builtInSubclass.name.toLocaleLowerCase())
  const needsSubclassProfile = Boolean(subclassRelevantAtTarget && selectedSubclass && !selectedSubclassIsBuiltIn && !subclassProfileRow)
  const subclassReference = subclassRelevantAtTarget && selectedSubclassIsBuiltIn ? builtInSubclass?.reference ?? null : null

  const context = {
    selected_ruleset: selectedRuleset,
    current_character: {
      name: current.character.name,
      total_level: current.character.total_level,
      classes: current.character.classes,
      proficiency_bonus: current.character.proficiency_bonus,
      maximum_hit_points: current.character.hit_points.maximum,
      resources: current.character.resources,
      spellcasting: current.character.spellcasting,
      features: characterFeatureEntries(current),
    },
    advancement_request: {
      advancing_class: classEntry.name,
      taking_new_class: takingNewClass,
      current_class_level: classEntry.level,
      target_class_level: targetClassLevel,
      target_total_level: targetTotalLevel,
    },
    player_supplied_advancement_profile: profile ? {
      title: profile.title,
      class_name: profile.class_name,
      ruleset: profile.ruleset,
      previous_level_row: previousProfileRow,
      target_level_row: profileRow,
      warnings: profile.warnings,
    } : null,
    subclass_advancement: {
      relevant_at_target_level: subclassRelevantAtTarget,
      current_subclass: currentSubclass,
      selected_subclass: selectedSubclass,
      built_in_subclass_name: builtInSubclass?.name || '',
      needs_player_subclass_profile: needsSubclassProfile,
      player_supplied_subclass_profile: subclassProfileRow ? {
        title: subclassProfile?.title || '',
        subclass_name: subclassProfile?.subclass_name || selectedSubclass,
        target_level_row: subclassProfileRow,
        warnings: subclassProfile?.warnings || [],
      } : null,
      built_in_subclass_reference: formatRulesReference(subclassReference),
    },
    built_in_rules_reference: formatRulesReference(rulesReference),
    multiclass_rules_reference: formatRulesReference(multiclassReference),
  }

  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL
  let reservation
  try {
    reservation = await reserveUsage(usageAccount, {
      maximumMicrousd: estimateTerraMaximumMicrousd(JSON.stringify(context).length + 36_000, 8_000, 1.55, 10),
      feature: 'level-up',
      sourceRef: `${current.character.name || 'character'}:level-${targetTotalLevel}`,
      operationId: request.headers.get('x-rpgyw-operation-id') || requestId,
    })
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: 'medium' },
        max_output_tokens: 8000,
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: `You prepare a guided one-level character advancement plan for RPG Your Way.

The player will review and approve every permanent change. Do not invent rules.

SOURCE PRIORITY:
1. If the player supplied an advancement profile and it contains the target class level, use that row as the authoritative advancement chart for names and numeric progression. It may identify a feature by name without explaining the feature. That is enough to add the feature NAME to the plan.
2. Otherwise, if the built-in SRD reference clearly contains the advancement information for this class and level, use it. RPG Your Way currently has built-in SRD references for selected Dungeons & Dragons and Pathfinder rulesets, but a class may still be outside that SRD. Do not assume a built-in ruleset means every class is covered.
3. If neither source contains enough information for the requested class level, return source_kind needs_profile, can_proceed false, and needs_advancement_profile true. Do not guess from general model knowledge.
4. When subclass_advancement.relevant_at_target_level is true and a subclass has been selected, also use either the player-supplied subclass target row or the built-in subclass reference. Add the actual newly gained subclass feature names for this level. Do not leave a generic Class Subclass or Subclass feature marker in feature_names when the actual subclass feature names are available.
5. If the selected subclass needs a player profile and no target row was supplied, do not invent that subclass's features. The browser will pause the level-up and ask the player for a screenshot, PDF, file, or pasted subclass advancement chart.
6. When advancement_request.taking_new_class is true, this is a multiclass entry level, not ordinary level-1 character creation. Use the supplied multiclass rules and the class's “As a Multiclass Character” traits. Do not grant full starting proficiencies, starting equipment, or level-1 starting Hit Points.
7. Whenever multiclass_rules_reference is supplied, respect its ongoing multiclass interactions. In particular, do not stack multiple Extra Attack features and do not combine alternative Armor Class calculations. Spell preparation remains class-specific even when spell slots are shared.

OUTPUT RULES:
- This is advancement bookkeeping, not a replacement rulebook. Name newly gained features but do not reproduce their descriptions.
- automatic_changes should plainly identify automatic progression at this level, including automatically granted subclass spells or other named benefits when the supplied source explicitly lists them.
- feature_names contains only newly gained named features from this level, including subclass feature names when subclass advancement applies.
- progression_values captures target-level quantities from the chart, such as Plans Known, Cantrips, Prepared Spells, Rage Uses, or similar labeled columns.
- spell_slots contains the target-level total spell slots when the source clearly supplies them.
- choices contains only player decisions that must be supplied before the record can be finalized. Give options only when the supplied SRD/reference explicitly provides a short finite option list. Otherwise leave options empty.
- For every choice, set selection_count to the exact number of items the player must choose for this level when the source states it. For example, if the source says to add two spells to a spellbook, selection_count is 2. Use 1 for ordinary single choices.
- Classify spell decisions with choice_kind: spellbook for adding spells to a spellbook; prepared_spell for selecting or adding prepared spells; known_spell for a ruleset that explicitly uses known spells; cantrip for cantrip choices; otherwise other. Do not put a full spell list in options. The interface supplies SRD spell-name lists separately.
- When a target-level progression value increases the number of prepared or known spells and the source makes that increase a player choice, include the corresponding spell choice rather than silently treating the new spell as automatic.
- Do not ask the player to paste feature descriptions merely to level up. Feature descriptions are optional and only help the AIGM recognize use opportunities during play.
- Do not calculate or guess the new maximum hit points. The interface independently calculates fixed or rolled hit points when the built-in SRD supplies the Hit Point Die, or asks the player for a finished maximum when it cannot safely calculate the method.
- If the supplied chart is ambiguous, put the uncertainty in warnings rather than guessing.`, }],
          },
          { role: 'user', content: [{ type: 'input_text', text: JSON.stringify(context) }] },
        ],
        text: { format: { type: 'json_schema', name: 'aigm_level_up_plan_1_0', strict: true, schema: LEVEL_UP_PLAN_SCHEMA } },
      }),
      signal: AbortSignal.timeout(110_000),
    })
    const payload = (await response.json()) as OpenAIResponsePayload
    if (!response.ok) {
      await releaseUsage(reservation, { model, metadata: { reason: 'provider_error', status: response.status } })
      reservation = null
      console.error('Level up planning failed', { requestId, status: response.status, error: payload.error })
      return jsonError(502, 'RPG Your Way had a temporary problem preparing that level-up.', requestId, 'Nothing was changed. Try again.')
    }
    const text = outputText(payload)
    if (!text) {
      await releaseUsage(reservation, { model, metadata: { reason: 'empty_provider_output' } })
      reservation = null
      return jsonError(502, 'The AIGM returned no readable level-up plan.', requestId)
    }
    let parsed: LevelUpPlan
    try {
      parsed = JSON.parse(text) as LevelUpPlan
    } catch {
      await releaseUsage(reservation, { model, metadata: { reason: 'invalid_structured_output' } })
      reservation = null
      return jsonError(502, 'The level-up plan came back in an unreadable format.', requestId)
    }
    const cleanedPlan = cleanPlan(parsed, classEntry.name, targetTotalLevel, targetClassLevel)
    const genericSubclassName = new RegExp(`^(?:${classEntry.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+)?subclass(?:\\s+feature)?$`, 'i')
    const sourcedSubclassFeatures = selectedSubclassIsBuiltIn
      ? builtInSubclassFeatureNamesAtLevel(selectedRuleset, classEntry.name, targetClassLevel)
      : (subclassProfileRow?.features ?? [])
    const cleanedFeatureNames = [...cleanedPlan.feature_names, ...sourcedSubclassFeatures]
      .map((name) => name.replace(/\s+/g, ' ').trim())
      .filter((name) => name && !genericSubclassName.test(name))
      .filter((name, index, list) => list.findIndex((candidate) => candidate.toLocaleLowerCase('en-US') === name.toLocaleLowerCase('en-US')) === index)
      .slice(0, 24)
    let cleanedChoices = subclassRelevantAtTarget
      ? cleanedPlan.choices.filter((choice) => !/\b(?:subclass|archetype)\b/i.test(`${choice.label} ${choice.help}`))
      : cleanedPlan.choices
    const dnd55Metadata = selectedRuleset.id === 'dnd-5.5e-srd-5.2.1' ? dnd55ClassMetadata(classEntry.name) : null
    const deterministicClassFeatures = dnd55Metadata?.featureNamesByLevel[targetClassLevel] ?? []
    const finalFeatureNames = [...cleanedFeatureNames, ...deterministicClassFeatures]
      .map((name) => name.replace(/\s+/g, ' ').trim())
      .filter((name) => name && !genericSubclassName.test(name))
      .filter((name, index, list) => list.findIndex((candidate) => candidate.toLocaleLowerCase('en-US') === name.toLocaleLowerCase('en-US')) === index)
      .slice(0, 24)
    const classFeatureNames = [...cleanedPlan.feature_names, ...deterministicClassFeatures]
      .map((name) => name.replace(/\s+/g, ' ').trim())
      .filter((name) => name && !genericSubclassName.test(name) && !sourcedSubclassFeatures.some((subclassFeature) => subclassFeature.toLocaleLowerCase('en-US') === name.toLocaleLowerCase('en-US')))
      .filter((name, index, list) => list.findIndex((candidate) => candidate.toLocaleLowerCase('en-US') === name.toLocaleLowerCase('en-US')) === index)
      .slice(0, 24)
    let automaticChanges = [...cleanedPlan.automatic_changes]
    if (takingNewClass && dnd55Metadata) {
      for (const trait of dnd55Metadata.multiclassAutomaticTraits) {
        if (!automaticChanges.some((entry) => entry.toLocaleLowerCase('en-US') === trait.toLocaleLowerCase('en-US'))) automaticChanges.push(trait)
      }
      const ids = new Set(cleanedChoices.map((choice) => choice.id))
      for (const prompt of dnd55Metadata.multiclassChoicePrompts) {
        if (ids.has(prompt.id)) continue
        cleanedChoices.push({ id: prompt.id, label: prompt.label, help: prompt.help, required: true, options: prompt.options, choice_kind: 'other', selection_count: 1 })
      }
    }
    const profileHitPointDie = Number(profile?.hit_point_die)
    const savedHitPointDie = Number.isInteger(profileHitPointDie) && profileHitPointDie >= 2 && profileHitPointDie <= 100 ? profileHitPointDie : 0
    const hitPointDie = hitPointDieForClass(selectedRuleset, classEntry.name) || savedHitPointDie
    const spellCatalog = srdSpellCatalogForClass(selectedRuleset, classEntry.name)
    const spellGuidance = levelUpSpellGuidanceForClass(selectedRuleset, classEntry.name)
    const replacementCantrips = spellGuidance.cantripReplacement
      ? srdSpellCatalogForClass(selectedRuleset, spellGuidance.cantripListClass).filter((spell) => spell.level === 0)
      : []
    const classesAfter = takingNewClass
      ? [...classes, { name: classEntry.name, level: 1, subclass: '' }]
      : classes.map((entry) => entry.name.trim().toLocaleLowerCase('en-US') === classEntry.name.trim().toLocaleLowerCase('en-US') ? { ...entry, level: targetClassLevel } : entry)
    const dnd55SlotsAreDeterministic = selectedRuleset.id === 'dnd-5.5e-srd-5.2.1' && dnd55CanDeterministicallyCombineSpellSlots(classesAfter)
    const multiclassSlots = dnd55SlotsAreDeterministic ? dnd55CombinedSpellSlots(classesAfter) : []
    const preservedCurrentSlots = current.character.spellcasting.slots.flatMap((slot) => {
      const level = typeof slot.level === 'string' ? slot.level.replace(/\s+/g, ' ').trim().slice(0, 30) : ''
      const total = typeof slot.total_shown === 'string' ? slot.total_shown.replace(/\s+/g, ' ').trim().slice(0, 30) : ''
      return level && total && total !== '—' ? [{ level, total }] : []
    })
    const unknownSlotClasses = selectedRuleset.id === 'dnd-5.5e-srd-5.2.1' ? dnd55UnverifiedSpellSlotSources(classesAfter) : []
    const finalWarnings = [...cleanedPlan.warnings]
    if (unknownSlotClasses.length > 0 && classesAfter.length > 1) {
      finalWarnings.push(`RPG Your Way cannot safely recalculate shared multiclass spell slots because ${unknownSlotClasses.join(', ')} ${unknownSlotClasses.length === 1 ? 'is' : 'are'} outside RPG Your Way’s deterministic SRD spell-slot metadata. Existing slot totals are preserved; verify any changed totals from your class source.`)
    }
    const plan: LevelUpPlan = {
      ...cleanedPlan,
      can_proceed: cleanedPlan.can_proceed && !needsSubclassProfile,
      is_new_class: takingNewClass,
      current_class_level: classEntry.level,
      proficiency_bonus: selectedRuleset.id === 'dnd-5.5e-srd-5.2.1' ? proficiencyBonusForTotalLevel(targetTotalLevel) : cleanedPlan.proficiency_bonus,
      automatic_changes: automaticChanges,
      feature_names: finalFeatureNames,
      class_feature_names: classFeatureNames,
      subclass_feature_names: sourcedSubclassFeatures,
      spell_slots: dnd55SlotsAreDeterministic
        ? (multiclassSlots.length > 0 ? multiclassSlots : cleanedPlan.spell_slots)
        : (unknownSlotClasses.length > 0 && classesAfter.length > 1 ? preservedCurrentSlots : cleanedPlan.spell_slots),
      choices: cleanedChoices,
      warnings: finalWarnings,
      subclass_required: subclassRelevantAtTarget && !currentSubclass,
      subclass_name: selectedSubclass,
      subclass_options: builtInSubclass ? [builtInSubclass.name] : [],
      needs_subclass_advancement_profile: needsSubclassProfile,
      subclass_source_label: selectedSubclassIsBuiltIn
        ? `${builtInSubclass?.name} · built-in SRD`
        : subclassProfileRow
          ? `${selectedSubclass} · player-supplied subclass chart`
          : '',
      hit_point_die: hitPointDie || undefined,
      fixed_hit_point_gain: hitPointDie ? Math.floor(hitPointDie / 2) + 1 : undefined,
      srd_spell_catalog: spellCatalog,
      srd_replacement_cantrips: replacementCantrips,
      srd_spell_max_level: maximumSpellLevel(cleanedPlan),
      spell_change_guidance: {
        level_one_plus_change: spellGuidance.levelOnePlusChange,
        cantrip_replacement: spellGuidance.cantripReplacement,
        replacement_source: spellGuidance.replacementSource,
        list_label: spellGuidance.listLabel,
      },
    }
    const billing = await settleUsage(reservation, {
      model,
      providerCostMicrousd: terraProviderCostMicrousd(payload.usage),
      metadata: { provider_request_id: payload.id || response.headers.get('x-request-id') },
    })
    reservation = null
    return NextResponse.json({
      plan,
      model,
      request_id: payload.id || requestId,
      usage_billing: {
        billed_microusd: billing.billedMicrousd,
        balance_microusd: billing.balanceMicrousd,
        owner_qa_exempt: billing.ownerQaExempt,
      },
    })
  } catch (error) {
    if (reservation) await releaseUsage(reservation, { model, metadata: { reason: 'request_failure' } })
    if (error && typeof error === 'object' && 'status' in error) return billingErrorResponse(error)
    console.error('Level up request failed', { requestId, error })
    return jsonError(502, 'RPG Your Way could not reach the level-up planner.', requestId, 'Nothing was changed. Try again.')
  }
}
