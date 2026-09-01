import type { CharacterIntakeResult, CharacterIntakeSettings, CurrencyState } from '@/lib/aigm/types'
import { normalizeCharacterIntakeResult } from '@/lib/aigm/character-intake-normalize'
import { canonicalizeCharacterRecord } from '@/lib/aigm/character-record'
import {
  CHARACTER_INTAKE_ANALYSIS_REVISION,
  CHARACTER_INTAKE_VERSION,
} from '@/lib/aigm/version'
import { emptyWeirdnessGate, type WeirdnessGate } from '@/lib/aigm/weirdness-gate'
import { normalizeAiContentMode, type AiContentMode } from '@/lib/site/ai-content-mode'
import { canonicalizeCampaignMemory, mergeCampaignRetcons, type CampaignMemoryEntry, type CampaignRetcon } from '@/lib/aigm/campaign-entities'
import type { DmMysteryCommitment } from '@/lib/aigm/mystery-commitments'

export type { WeirdnessGate } from '@/lib/aigm/weirdness-gate'
export type { CampaignMemoryEntry, CampaignRetcon } from '@/lib/aigm/campaign-entities'
export type { DmMysteryCommitment, DmMysteryCommitmentStatus } from '@/lib/aigm/mystery-commitments'

export type CharacterStatus = 'queued' | 'analyzing' | 'needs_answer' | 'ready' | 'error'
export type OnboardingStage = 'party' | 'calibration' | 'complete'
export type CampaignMode = 'solo' | 'multiplayer'
export type MultiplayerAdministrationMode = 'shared' | 'coordinator'
export type CampaignAdministrationMode = 'solo' | MultiplayerAdministrationMode

export interface ConversationMessage {
  role: 'user' | 'assistant'
  text: string
}

export interface GameplayMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  created_at: string
  /** Permanent order in the raw transcript. Legacy messages receive this during migration. */
  sequence: number
  /** Exact campaign turn when known. Legacy transcript messages remain null rather than inventing precision. */
  turn_number: number | null
  /** Groups a player turn with the Game Master response. Legacy messages may not have one. */
  exchange_id: string | null
}


export interface LiveResourceState {
  name: string
  current: string
  maximum: string
}

export interface LiveSpellSlotState {
  level: string
  total: string
  used: string
}

export interface CharacterLiveState {
  current_hit_points: number
  maximum_hit_points: number
  temporary_hit_points: number
  armor_class: number
  conditions: string[]
  concentration: string
  death_saves: {
    successes: number
    failures: number
  }
  resources: LiveResourceState[]
  spell_slots: LiveSpellSlotState[]
  currency: CurrencyState
  notes: string[]
}

export interface InitiativeEntry {
  character_id: string
  entity_type: 'player' | 'npc'
  name: string
  modifier: number
  roll: number
  total: number
}

export interface VttSetupFeature {
  label: string
  kind: 'room' | 'wall' | 'door' | 'obstacle' | 'furniture' | 'terrain'
  x_ft: number
  y_ft: number
  width_ft: number
  height_ft: number
}

export interface VttSetupActorHint {
  name: string
  side: 'enemy' | 'ally'
  visual_tags: string[]
  x_ft: number
  y_ft: number
}

export interface VttSetupPlan {
  enabled: boolean
  environment: string
  width_ft: number
  height_ft: number
  player_start_area: {
    x_ft: number
    y_ft: number
    width_ft: number
    height_ft: number
  }
  features: VttSetupFeature[]
  actors: VttSetupActorHint[]
  asset_search_terms: string[]
}

export type DiceMode = 'purist' | 'cheat'
export type VoiceGuidedDicePreference = 'player_rolls' | 'aigm_rolls' | 'ask_each_time'

export interface VoiceGuidedPlaySettings {
  enabled: boolean
  guidance_level: number
  dice_preference: VoiceGuidedDicePreference
}

export type CampaignDirection = 'mostly_open' | 'gentle_story' | 'strong_arc'
export type CampaignScale = 'grounded' | 'occasionally_strange' | 'epic' | 'cosmic'

export interface DmSecretsState {
  initialized: boolean
  campaign_mode: string
  scale_ceiling: string
  level_5_convergence: string
  level_10_convergence: string
  level_15_convergence: string
  level_20_convergence: string
  early_seeds: string[]
  active_threads: string[]
  dormant_threads: string[]
  wildcard_seeds: string[]
  retired_threads: string[]
  recent_player_direction: string
  next_reassessment_trigger: string
  mythic_resonance: string[]
  combat_assessment: string[]
  /** Durable private answers for substantial mysteries. Existing truths are not silently rewritten. */
  mystery_commitments: DmMysteryCommitment[]
  weirdness_gate: WeirdnessGate
  last_reassessed_turn: number
}

export interface GameplayState {
  /** Rolling window rendered in play and supplied to the AI. */
  messages: GameplayMessage[]
  /** Complete raw player/AIGM gameplay transcript. Multiplayer table chat is separate. */
  transcript: GameplayMessage[]
  campaign_summary: string
  scene: string
  turn_count: number
  combat_active: boolean
  initiative: InitiativeEntry[]
  /** Latest tactical board setup requested by the AIGM. */
  vtt_setup: VttSetupPlan | null
  /** Manual roller behavior. Cheat mode is the default for existing saves. */
  dice_mode: DiceMode
  /** Private future-facing Game Master notes. Not shown in ordinary play. */
  dm_secrets: DmSecretsState
  /** Canonical searchable entity catalogue. History remains in the raw transcript. */
  memory_index: CampaignMemoryEntry[]
  /** Explicit player retcons that supersede conflicting historical statements during ordinary play. */
  retcons: CampaignRetcon[]
  /** Characters the AIGM has told the player are ready to advance through the Level Up interface. */
  pending_level_ups: string[]
}

export interface AdvancementProgressionValue {
  name: string
  value: string
}

export interface AdvancementSpellSlotValue {
  level: string
  total: string
}

export interface AdvancementFeatureDetail {
  name: string
  text: string
}

export interface AdvancementLevelRow {
  level: number
  proficiency_bonus: string
  features: string[]
  /** Character-relevant feature rules retained from player-supplied advancement material. Older profiles may omit this. */
  feature_details?: AdvancementFeatureDetail[]
  progression_values: AdvancementProgressionValue[]
  spell_slots: AdvancementSpellSlotValue[]
}

export type ClassLevelHitPointMethod = 'roll' | 'fixed' | 'other' | 'imported'

export interface CharacterClassLevelChoice {
  label: string
  value: string
}

export interface CharacterClassLevelHistory {
  class_level: number
  total_character_level: number
  hit_points_gained?: number
  hit_point_method?: ClassLevelHitPointMethod
  automatic_changes: string[]
  choices: CharacterClassLevelChoice[]
  class_feature_names: string[]
  subclass_name: string
  subclass_feature_names: string[]
  progression_values: AdvancementProgressionValue[]
  recorded_at: string
}

export interface CharacterClassRecord {
  class_name: string
  hit_point_die?: number
  levels: CharacterClassLevelHistory[]
}

export interface CharacterAdvancementProfile {
  title: string
  class_name: string
  ruleset: string
  source_name: string
  /** Older saved profiles omit these fields and are treated as class profiles. */
  profile_kind?: 'class' | 'subclass'
  subclass_name?: string
  /** Class-profile Hit Point Die, when the supplied source or player identifies one. */
  hit_point_die?: number
  levels: AdvancementLevelRow[]
  warnings: string[]
}

export interface StoredPartyCharacter {
  id: string
  sourceFileName: string
  fileFingerprint: string
  status: CharacterStatus
  result: CharacterIntakeResult | null
  model: string | null
  conversation: ConversationMessage[]
  error: string | null
  playName: string
  liveState?: CharacterLiveState
  sourceText?: string
  sourceMimeType?: string
  portraitUrl?: string
  starterId?: string
  /** Player-supplied level progression, stored as a compact chart rather than sourcebook prose. */
  advancementProfiles?: CharacterAdvancementProfile[]
  /** RPG Your Way-owned per-class advancement bookkeeping. Older campaigns may omit it. */
  classRecords?: CharacterClassRecord[]
}

export interface SavedAdventureState {
  storage_schema: 2
  version: typeof CHARACTER_INTAKE_VERSION
  analysis_revision: typeof CHARACTER_INTAKE_ANALYSIS_REVISION
  /** One-time Build 4.12 server-side SRD/profile enrichment for migrated 4.11 records. */
  character_record_migration?: 'needs_srd_enrichment' | 'complete'
  adventure_id: string
  adventure_name: string
  /** Solo campaigns belong to one account; multiplayer campaigns use persistent cloud membership. */
  campaign_mode?: CampaignMode
  /** Multiplayer housekeeping is either collective Shared Control or delegated Coordinator Control. */
  multiplayer_administration?: MultiplayerAdministrationMode
  game_master_name: string
  campaign_direction: CampaignDirection
  campaign_scale: CampaignScale
  lore_fidelity: number
  content_mode: AiContentMode
  /** The saved mode came from an imported campaign file. */
  imported_content_mode?: AiContentMode | null
  /** The imported mode differed from the onboarding selection at import time. */
  content_mode_import_mismatch?: boolean
  /** The AIGM has already explained the imported-mode mismatch at a relevant refusal. */
  content_mode_explanation_given?: boolean
  created_at: string
  updated_at: string
  settings: CharacterIntakeSettings
  characters: StoredPartyCharacter[]
  setup_answers: string[]
  setup_conversation: ConversationMessage[]
  general_conversation: ConversationMessage[]
  stage: OnboardingStage
  gameplay: GameplayState
  starter_defaults_seeded?: boolean
  /** The player explicitly chose the starter party, imported characters, or a mixed party. */
  party_choice_confirmed?: boolean
  /** Optional spoken, step-by-step play profile. Designed as a player preference, not a diagnosis. */
  voice_guided_play?: VoiceGuidedPlaySettings
  /** How proactively the AIGM should point out applicable character abilities, 1 (hands off) to 10 (very active). */
  character_assistance_level?: number
}

export interface AdventureSummary {
  adventure_id: string
  adventure_name: string
  campaign_mode?: CampaignMode
  campaign_administration?: CampaignAdministrationMode
  cloud_revision?: number
  cloud_membership?: 'solo_owner' | 'coordinator' | 'member'
  storage_source?: 'cloud' | 'legacy_local'
  updated_at: string
  stage: OnboardingStage
  party_names: string[]
}

export const ADVENTURE_STORAGE_SCHEMA = 2 as const
export const LEGACY_ADVENTURE_STORAGE_SCHEMA = 1 as const
export const MAX_PLAY_NAME_LENGTH = 12
export const CURRENT_ADVENTURE_KEY = 'aigm-current-adventure:v1'
export const EDIT_PARTY_SESSION_KEY = 'wardenspc:aigm:edit-party:v1'
export const ADVENTURE_INDEX_KEY = 'aigm-adventure-index:v1'
export const ADVENTURE_PREFIX = 'aigm-adventure:v1:'
export const FALLBACK_ADVENTURE_PREFIX = 'aigm-adventure:v2-fallback:'
export const ADVENTURE_MIGRATION_PREFIX = 'aigm-adventure:migrated:v2:'
export const LEGACY_PARTY_STORAGE_KEY = `aigm-party-onboarding:${CHARACTER_INTAKE_ANALYSIS_REVISION}`
export const CHARACTER_CACHE_PREFIX = `aigm-character-intake-cache:${CHARACTER_INTAKE_ANALYSIS_REVISION}:`

export function canonicalAdventureName(value: string) {
  const clean = value.replace(/(?:\s*\(imported\))+\s*$/gi, '').replace(/\s+/g, ' ').trim()
  return clean || 'Untitled adventure'
}


const LEGACY_SETUP_PREFERENCES: Record<string, string> = {
  gm_regularly_drives_events: 'The Game Master should regularly introduce events and keep the action moving.',
  balanced_tone_with_humor_seriousness_exploration_mystery_social_play_and_combat: 'Include humor, serious stakes, exploration, mystery, social play, and combat.',
  player_controlled_backstories_relationships_and_private_knowledge: 'Keep backstories and party relationships player-controlled, and keep private character knowledge private until a player reveals or uses it.',
  dangerous_but_not_deadly: 'Make the campaign dangerous, but not generally deadly.',
}

function readableSetupAnswer(value: string) {
  const trimmed = value.trim()
  if (!trimmed.startsWith('{')) return trimmed
  try {
    const parsed = JSON.parse(trimmed) as { preference?: unknown }
    if (typeof parsed.preference !== 'string' || !parsed.preference.trim()) return trimmed
    const preference = parsed.preference.trim()
    const known = LEGACY_SETUP_PREFERENCES[preference]
    if (known) return known
    const words = preference.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
    return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}.` : trimmed
  } catch {
    return trimmed
  }
}

export function migrateSetupAnswers(answers: unknown, stage: OnboardingStage): string[] {
  const clean = Array.isArray(answers)
    ? answers.filter((answer): answer is string => typeof answer === 'string').map(readableSetupAnswer).filter(Boolean)
    : []
  if (clean.length >= 6) return clean.slice(0, 6)
  if (stage === 'complete' && clean.length === 5) {
    return [
      clean[0],
      clean[1],
      clean[2],
      clean[3],
      'Use the exclusions and safety limits included in answer 4.',
      clean[4],
    ]
  }
  return clean
}

const TITLE_WORDS = /^(?:sir|lady|lord|dame|master|mistress|captain|capt\.?|sergeant|sgt\.?|private|pvt\.?|doctor|dr\.?|professor|prof\.?)\s+/i


function safeCount(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback
}

function safeShortText(value: unknown, maximum = 120) {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : ''
}


function checkboxCounts(value: string) {
  const tokens = value.match(/\[(?:\s|x|X|✓|✔)?\]|[☐☑☒]/g) ?? []
  return {
    total: tokens.length,
    checked: tokens.filter((token) => /x|X|✓|✔|☑|☒/.test(token)).length,
  }
}

function cleanResourceName(value: unknown) {
  return safeShortText(value, 120)
    .replace(/\[(?:\s|x|X|✓|✔)?\]|[☐☑☒]/g, ' ')
    .replace(/\s+\d+\s+total\b.*$/i, '')
    .replace(/\s+\d+\s+(?:of|out of)\s+\d+\b.*$/i, '')
    .replace(/\s+\d+\s*\/\s*\d+\s*$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[\s:;,([{/-]+$/g, '')
    .trim()
    .slice(0, 80)
}

function resourceNumbers(name: string, currentValue: string, maximumValue: string) {
  const current = safeShortText(currentValue, 60)
  const maximum = safeShortText(maximumValue, 60)
  const combined = `${current} ${maximum} ${name}`.trim()

  if (/heroic inspiration/i.test(name)) {
    const boxes = checkboxCounts(combined)
    if (boxes.total > 0) return { current: boxes.checked > 0 ? '1' : '0', maximum: '1' }
    const number = combined.match(/\b([01])\b/)
    return { current: number?.[1] === '1' ? '1' : '0', maximum: '1' }
  }

  const fraction = combined.match(/\b(\d+)\s*\/\s*(\d+)\b/)
  if (fraction) return { current: fraction[1], maximum: fraction[2] }

  const remaining = combined.match(/\b(\d+)\s+(?:of|out of)\s+(\d+)\b/i)
  if (remaining) return { current: remaining[1], maximum: remaining[2] }

  const totalUsed = combined.match(/\b(\d+)\s+total\b[^\d]*(\d+)\s+used\b/i)
  if (totalUsed) {
    const total = Number(totalUsed[1])
    const used = Number(totalUsed[2])
    return { current: String(Math.max(0, total - used)), maximum: String(total) }
  }

  const boxes = checkboxCounts(combined)
  if (boxes.total > 0) return { current: String(Math.max(0, boxes.total - boxes.checked)), maximum: String(boxes.total) }

  const currentNumber = current.match(/^\s*(\d+)\s*$/)?.[1]
  const maximumNumber = maximum.match(/^\s*(\d+)\s*$/)?.[1]
  if (currentNumber || maximumNumber) return {
    current: currentNumber || maximumNumber || '',
    maximum: maximumNumber || currentNumber || '',
  }

  return null
}

function normalizedResourceRows(result: CharacterIntakeResult) {
  const rows = (result.character.resources ?? []).flatMap((entry) => {
    const rawName = safeShortText(entry.name, 120)
    const name = cleanResourceName(rawName)
    if (!name) return []
    const numbers = resourceNumbers(rawName, entry.current_shown_on_sheet, entry.maximum_or_frequency)
    if (!numbers) return []
    return [{ name, ...numbers }]
  })

  for (const item of result.character.equipment_highlights ?? []) {
    const joined = `${item.name} ${item.quantity} ${item.sheet_status}`
    const uses = joined.match(/\b(\d+)\s+uses?\b/i)?.[1]
    if (!uses) continue
    const name = safeShortText(item.name.replace(/\s*x?\d+.*$/i, ''), 80) || safeShortText(item.name, 80)
    if (!name || rows.some((row) => row.name.toLocaleLowerCase() === name.toLocaleLowerCase())) continue
    rows.push({ name, current: uses, maximum: uses })
  }

  const deduped = new Map<string, LiveResourceState>()
  for (const row of rows) {
    const key = row.name.toLocaleLowerCase()
    const prior = deduped.get(key)
    if (!prior || (Number(row.maximum) || 0) > (Number(prior.maximum) || 0)) deduped.set(key, row)
  }
  return Array.from(deduped.values()).slice(0, 30)
}

function normalizeStoredResourceRows(value: unknown, fallback: LiveResourceState[]) {
  if (!Array.isArray(value)) return fallback
  const rows = value.flatMap((entry) => {
    const source = entry as Partial<LiveResourceState> | null
    const name = cleanResourceName(source?.name)
    if (!name) return []
    const numbers = resourceNumbers(name, safeShortText(source?.current, 60), safeShortText(source?.maximum, 60))
    return numbers ? [{ name, ...numbers }] : []
  })
  if (rows.length === 0) return fallback
  const deduped = new Map(fallback.map((row) => [row.name.toLocaleLowerCase(), row]))
  rows.forEach((row) => deduped.set(row.name.toLocaleLowerCase(), row))
  return Array.from(deduped.values()).slice(0, 30)
}

function normalizeSpellSlotRow(levelValue: unknown, totalValue: unknown, usedValue: unknown): LiveSpellSlotState | null {
  const level = safeShortText(levelValue, 30)
  if (!level) return null
  const total = safeShortText(totalValue, 80)
  const used = safeShortText(usedValue, 80)
  const combined = `${total} ${used}`.trim()
  const totalUsed = combined.match(/\b(\d+)\s+total\b[^\d]*(\d+)\s+used\b/i)
  if (totalUsed) return { level, total: totalUsed[1], used: totalUsed[2] }

  const boxes = checkboxCounts(combined)
  if (boxes.total > 0) return { level, total: String(boxes.total), used: String(boxes.checked) }

  const fraction = combined.match(/\b(\d+)\s*\/\s*(\d+)\b/)
  if (fraction) return { level, total: fraction[2], used: String(Math.max(0, Number(fraction[2]) - Number(fraction[1]))) }

  return { level, total: safeShortText(totalValue, 30), used: safeShortText(usedValue, 30) }
}

function normalizeStoredSpellSlots(value: unknown, fallback: LiveSpellSlotState[]) {
  if (!Array.isArray(value)) return fallback
  const normalized = value
    .slice(0, 12)
    .map((entry) => {
      const source = entry as Partial<LiveSpellSlotState> | null
      return normalizeSpellSlotRow(source?.level, source?.total, source?.used)
    })
    .filter((entry): entry is LiveSpellSlotState => Boolean(entry))
  if (normalized.length === 0) return fallback
  const merged = new Map(fallback.map((entry) => [entry.level.toLocaleLowerCase(), entry]))
  normalized.forEach((entry) => merged.set(entry.level.toLocaleLowerCase(), entry))
  return Array.from(merged.values()).slice(0, 12)
}

function normalizeLiveCurrency(value: Partial<CurrencyState> | null | undefined, fallback: CurrencyState): CurrencyState {
  const cp = safeCount(value?.cp, fallback.cp)
  const sp = safeCount(value?.sp, fallback.sp)
  const ep = safeCount(value?.ep, fallback.ep)
  const gp = safeCount(value?.gp, fallback.gp)
  const pp = safeCount(value?.pp, fallback.pp)
  return {
    cp,
    sp,
    ep,
    gp,
    pp,
    total_gp_value: Number((cp / 100 + sp / 10 + ep / 2 + gp + pp * 10).toFixed(2)),
  }
}

export function initialLiveState(result: CharacterIntakeResult): CharacterLiveState {
  const maximumHitPoints = safeCount(result.character.hit_points.maximum)
  const reportedCurrentHitPoints = safeCount(result.opening_state.current_hit_points, maximumHitPoints)
  return {
    current_hit_points: maximumHitPoints > 0 ? Math.min(reportedCurrentHitPoints, maximumHitPoints) : reportedCurrentHitPoints,
    maximum_hit_points: maximumHitPoints,
    temporary_hit_points: safeCount(result.opening_state.temporary_hit_points),
    armor_class: safeCount(result.character.armor_class),
    conditions: (result.opening_state.condition_notes ?? []).map((entry) => safeShortText(entry, 80)).filter(Boolean).slice(0, 12),
    concentration: '',
    death_saves: { successes: 0, failures: 0 },
    resources: normalizedResourceRows(result),
    spell_slots: (result.character.spellcasting?.slots ?? [])
      .slice(0, 12)
      .map((entry) => normalizeSpellSlotRow(entry.level, entry.total_shown, entry.used_shown))
      .filter((entry): entry is LiveSpellSlotState => Boolean(entry)),
    currency: normalizeLiveCurrency(result.character.currency, result.character.currency),
    notes: [],
  }
}

function normalizeLiveStateAgainst(
  value: Partial<CharacterLiveState> | null | undefined,
  fallback: CharacterLiveState,
): CharacterLiveState {
  if (!value) return fallback
  const deathSaves = value.death_saves ?? fallback.death_saves
  const reportedMaximumHitPoints = safeCount(value.maximum_hit_points, fallback.maximum_hit_points)
  const maximumHitPoints = reportedMaximumHitPoints > 0 ? reportedMaximumHitPoints : fallback.maximum_hit_points
  const reportedCurrentHitPoints = safeCount(value.current_hit_points, fallback.current_hit_points)
  const reportedArmorClass = safeCount(value.armor_class, fallback.armor_class)
  return {
    current_hit_points: maximumHitPoints > 0 ? Math.min(reportedCurrentHitPoints, maximumHitPoints) : reportedCurrentHitPoints,
    maximum_hit_points: maximumHitPoints,
    temporary_hit_points: safeCount(value.temporary_hit_points, fallback.temporary_hit_points),
    armor_class: reportedArmorClass > 0 ? reportedArmorClass : fallback.armor_class,
    conditions: Array.isArray(value.conditions) ? value.conditions.map((entry) => safeShortText(entry, 80)).filter(Boolean).slice(0, 12) : fallback.conditions,
    concentration: value.concentration === undefined ? fallback.concentration : safeShortText(value.concentration, 120),
    death_saves: {
      successes: Math.min(3, safeCount(deathSaves.successes, fallback.death_saves.successes)),
      failures: Math.min(3, safeCount(deathSaves.failures, fallback.death_saves.failures)),
    },
    resources: normalizeStoredResourceRows(value.resources, fallback.resources),
    spell_slots: normalizeStoredSpellSlots(value.spell_slots, fallback.spell_slots),
    currency: normalizeLiveCurrency(value.currency, fallback.currency),
    notes: Array.isArray(value.notes) ? value.notes.map((entry) => safeShortText(entry, 180)).filter(Boolean).slice(-5) : fallback.notes,
  }
}

export function normalizeLiveState(value: Partial<CharacterLiveState> | null | undefined, result: CharacterIntakeResult): CharacterLiveState {
  return normalizeLiveStateAgainst(value, initialLiveState(result))
}

/**
 * Apply a gameplay response to the character's existing live state. Gameplay
 * responses may contain only the rows that changed, so the current state must
 * be the fallback rather than the original character sheet. This prevents a
 * passive resource update from restoring previously spent uses or spell slots.
 */
function mergeRecentCharacterUpdates(current: string[], incoming: string[] | null | undefined) {
  const merged: string[] = []
  const seen = new Set<string>()
  for (const raw of [...current, ...(Array.isArray(incoming) ? incoming : [])]) {
    const clean = safeShortText(raw, 180)
    if (!clean) continue
    const key = clean.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(clean)
  }
  return merged.slice(-5)
}

export function mergeLiveStateUpdate(
  current: Partial<CharacterLiveState> | null | undefined,
  update: Partial<CharacterLiveState> | null | undefined,
  result: CharacterIntakeResult,
): CharacterLiveState {
  const currentState = normalizeLiveState(current, result)
  const mergedState = normalizeLiveStateAgainst(update, currentState)
  return {
    ...mergedState,
    notes: mergeRecentCharacterUpdates(currentState.notes, update?.notes),
  }
}


function liveRowKey(value: string) {
  return value.trim().toLocaleLowerCase()
}

/**
 * Reconcile permanent record edits with current gameplay state. Permanent
 * corrections to maximum HP, AC, resources, and spell-slot capacity become
 * authoritative while spent uses, damage, conditions, and other live values
 * remain intact.
 */
export function reconcileLiveStateAfterRecordEdit(
  current: Partial<CharacterLiveState> | null | undefined,
  previousResult: CharacterIntakeResult,
  revisedResult: CharacterIntakeResult,
): CharacterLiveState {
  const priorLive = normalizeLiveState(current, previousResult)
  const previousDefaults = initialLiveState(previousResult)
  const revisedDefaults = initialLiveState(revisedResult)

  const priorResources = new Map(priorLive.resources.map((row) => [liveRowKey(row.name), row]))
  const previousDefaultResources = new Set(previousDefaults.resources.map((row) => liveRowKey(row.name)))
  const revisedResourceKeys = new Set<string>()
  const resources = revisedDefaults.resources.map((row) => {
    const key = liveRowKey(row.name)
    revisedResourceKeys.add(key)
    const prior = priorResources.get(key)
    return prior ? { ...row, current: prior.current } : row
  })

  for (const row of priorLive.resources) {
    const key = liveRowKey(row.name)
    if (!revisedResourceKeys.has(key) && !previousDefaultResources.has(key)) resources.push(row)
  }

  const priorSpellSlots = new Map(priorLive.spell_slots.map((row) => [liveRowKey(row.level), row]))
  const spellSlots = revisedDefaults.spell_slots.map((row) => {
    const prior = priorSpellSlots.get(liveRowKey(row.level))
    return prior ? { ...row, used: prior.used } : row
  })

  const recordMaximumChanged = revisedResult.character.hit_points.maximum !== previousResult.character.hit_points.maximum
  const recordArmorClassChanged = revisedResult.character.armor_class !== previousResult.character.armor_class
  const coinKeys = ['cp', 'sp', 'ep', 'gp', 'pp'] as const
  const recordCurrencyChanged = coinKeys.some((coin) => revisedResult.character.currency[coin] !== previousResult.character.currency[coin])
  const maximumHitPoints = recordMaximumChanged ? revisedDefaults.maximum_hit_points : priorLive.maximum_hit_points
  const armorClass = recordArmorClassChanged ? revisedDefaults.armor_class : priorLive.armor_class

  return {
    ...priorLive,
    current_hit_points: maximumHitPoints > 0 ? Math.min(priorLive.current_hit_points, maximumHitPoints) : priorLive.current_hit_points,
    maximum_hit_points: maximumHitPoints,
    armor_class: armorClass,
    resources: resources.slice(0, 30),
    spell_slots: spellSlots.slice(0, 12),
    currency: recordCurrencyChanged ? revisedDefaults.currency : priorLive.currency,
  }
}

export function emptyDmSecretsState(): DmSecretsState {
  return {
    initialized: false,
    campaign_mode: '',
    scale_ceiling: '',
    level_5_convergence: '',
    level_10_convergence: '',
    level_15_convergence: '',
    level_20_convergence: '',
    early_seeds: [],
    active_threads: [],
    dormant_threads: [],
    wildcard_seeds: [],
    retired_threads: [],
    recent_player_direction: '',
    next_reassessment_trigger: '',
    mythic_resonance: [],
    combat_assessment: [],
    mystery_commitments: [],
    weirdness_gate: emptyWeirdnessGate(),
    last_reassessed_turn: 0,
  }
}

function normalizedStringList(value: unknown, count: number, maximum: number) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim().slice(0, maximum)).filter(Boolean).slice(0, count)
    : []
}

function normalizeMysteryCommitments(value: unknown): DmMysteryCommitment[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: DmMysteryCommitment[] = []
  for (const raw of value) {
    const item = raw as Partial<DmMysteryCommitment> | null
    const id = safeShortText(item?.id, 120)
    const question = safeShortText(item?.question, 300)
    const hiddenTruth = safeShortText(item?.hidden_truth, 800)
    if (!id || !question || !hiddenTruth || seen.has(id)) continue
    seen.add(id)
    result.push({
      id,
      question,
      hidden_truth: hiddenTruth,
      status: item?.status === 'resolved' || item?.status === 'retired' ? item.status : 'active',
    })
    if (result.length >= 10) break
  }
  return result
}

function normalizeDmSecrets(value: Partial<DmSecretsState> | null | undefined): DmSecretsState {
  const fallback = emptyDmSecretsState()
  if (!value) return fallback
  const gate = value.weirdness_gate
  return {
    initialized: Boolean(value.initialized),
    campaign_mode: safeShortText(value.campaign_mode, 180),
    scale_ceiling: safeShortText(value.scale_ceiling, 180),
    level_5_convergence: safeShortText(value.level_5_convergence, 700),
    level_10_convergence: safeShortText(value.level_10_convergence, 700),
    level_15_convergence: safeShortText(value.level_15_convergence, 700),
    level_20_convergence: safeShortText(value.level_20_convergence, 700),
    early_seeds: normalizedStringList(value.early_seeds, 12, 360),
    active_threads: normalizedStringList(value.active_threads, 12, 420),
    dormant_threads: normalizedStringList(value.dormant_threads, 16, 420),
    wildcard_seeds: normalizedStringList(value.wildcard_seeds, 12, 420),
    retired_threads: normalizedStringList(value.retired_threads, 12, 320),
    recent_player_direction: safeShortText(value.recent_player_direction, 700),
    next_reassessment_trigger: safeShortText(value.next_reassessment_trigger, 320),
    mythic_resonance: normalizedStringList(value.mythic_resonance, 10, 420),
    combat_assessment: normalizedStringList(value.combat_assessment, 12, 360),
    mystery_commitments: normalizeMysteryCommitments(value.mystery_commitments),
    weirdness_gate: gate?.status === 'awaiting_player_roll'
      ? {
          status: 'awaiting_player_roll',
          threshold: Math.min(100, Math.max(1, safeCount(gate.threshold, 1))),
          opened_at_turn: safeCount(gate.opened_at_turn),
          purpose_hint: safeShortText(gate.purpose_hint, 300),
          trigger_after_turn: 0,
          resolve_by_turn: 0,
          red_herring_exchanges_remaining: 0,
        }
      : gate?.status === 'armed'
        ? {
            status: 'armed',
            threshold: Math.min(100, Math.max(1, safeCount(gate.threshold, 1))),
            opened_at_turn: safeCount(gate.opened_at_turn),
            purpose_hint: safeShortText(gate.purpose_hint, 300),
            trigger_after_turn: safeCount(gate.trigger_after_turn),
            resolve_by_turn: safeCount(gate.resolve_by_turn),
            red_herring_exchanges_remaining: 0,
          }
        : gate?.status === 'red_herring_countdown'
          ? {
              status: 'red_herring_countdown',
              threshold: 0,
              opened_at_turn: safeCount(gate.opened_at_turn),
              purpose_hint: '',
              trigger_after_turn: 0,
              resolve_by_turn: 0,
              red_herring_exchanges_remaining: Math.min(12, Math.max(1, safeCount(gate.red_herring_exchanges_remaining, 1))),
            }
          : fallback.weirdness_gate,
    last_reassessed_turn: safeCount(value.last_reassessed_turn),
  }
}

function normalizeMemoryIndex(value: unknown): CampaignMemoryEntry[] {
  if (!Array.isArray(value)) return []
  const allowedKinds = new Set(['location', 'npc', 'faction', 'item', 'promise', 'relationship', 'event', 'mystery', 'character', 'other'])
  const normalized = value.flatMap((entry) => {
    const item = entry as Partial<CampaignMemoryEntry> | null
    const title = safeShortText(item?.title, 140)
    const summary = safeShortText(item?.summary, 700)
    if (!title || !summary) return []
    return [{
      id: safeShortText(item?.id, 120) || crypto.randomUUID(),
      kind: allowedKinds.has(String(item?.kind)) ? item?.kind as CampaignMemoryEntry['kind'] : 'other',
      title,
      summary,
      keywords: normalizedStringList(item?.keywords, 40, 80),
      first_turn: safeCount(item?.first_turn),
      last_turn: safeCount(item?.last_turn),
      source_excerpt: safeShortText(item?.source_excerpt, 1200),
      aliases: normalizedStringList(item?.aliases, 32, 140),
      revision: Math.max(1, safeCount(item?.revision, 1)),
    }]
  })
  return canonicalizeCampaignMemory(normalized)
}

function normalizeVttSetup(value: unknown): VttSetupPlan | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const source = value as Partial<VttSetupPlan>
  if (source.enabled !== true) return null

  const snap = (raw: unknown, fallback = 0, maximum = 300) => {
    const number = typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback
    return Math.max(0, Math.min(maximum, Math.round(number / 5) * 5))
  }
  const width = Math.max(20, snap(source.width_ft, 60))
  const height = Math.max(20, snap(source.height_ft, 40))
  const start = source.player_start_area && typeof source.player_start_area === 'object'
    ? source.player_start_area
    : { x_ft: 5, y_ft: 5, width_ft: 15, height_ft: Math.max(10, height - 10) }

  const features: VttSetupFeature[] = Array.isArray(source.features)
    ? source.features.slice(0, 16).flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return []
        const feature = entry as Partial<VttSetupFeature>
        const kind = feature.kind === 'wall'
          || feature.kind === 'door'
          || feature.kind === 'obstacle'
          || feature.kind === 'furniture'
          || feature.kind === 'terrain'
          ? feature.kind
          : 'room'
        return [{
          label: safeShortText(feature.label, 80) || kind,
          kind,
          x_ft: snap(feature.x_ft, 0, width),
          y_ft: snap(feature.y_ft, 0, height),
          width_ft: Math.max(5, snap(feature.width_ft, 5, width)),
          height_ft: Math.max(5, snap(feature.height_ft, 5, height)),
        }]
      })
    : []

  const actors = Array.isArray(source.actors)
    ? source.actors.slice(0, 40).flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return []
        const actor = entry as Partial<VttSetupActorHint>
        const name = safeShortText(actor.name, 80)
        if (!name) return []
        return [{
          name,
          side: actor.side === 'ally' ? 'ally' as const : 'enemy' as const,
          visual_tags: normalizedStringList(actor.visual_tags, 10, 80),
          x_ft: snap(actor.x_ft, width - 10, width),
          y_ft: snap(actor.y_ft, 5, height),
        }]
      })
    : []

  return {
    enabled: true,
    environment: safeShortText(source.environment, 120) || 'combat area',
    width_ft: width,
    height_ft: height,
    player_start_area: {
      x_ft: snap(start.x_ft, 5, width),
      y_ft: snap(start.y_ft, 5, height),
      width_ft: Math.max(5, snap(start.width_ft, 15, width)),
      height_ft: Math.max(5, snap(start.height_ft, Math.max(10, height - 10), height)),
    },
    features,
    actors,
    asset_search_terms: normalizedStringList(source.asset_search_terms, 16, 80),
  }
}

function normalizeRetcons(value: unknown): CampaignRetcon[] {
  if (!Array.isArray(value)) return []
  const normalized = value.flatMap((entry) => {
    const item = entry as Partial<CampaignRetcon> | null
    const subject = safeShortText(item?.subject, 180)
    const canonicalFact = safeShortText(item?.canonical_fact, 900)
    if (!subject || !canonicalFact) return []
    return [{
      id: safeShortText(item?.id, 120) || crypto.randomUUID(),
      subject,
      canonical_fact: canonicalFact,
      keywords: normalizedStringList(item?.keywords, 40, 80),
      turn: safeCount(item?.turn),
      source_excerpt: safeShortText(item?.source_excerpt, 1200),
      created_at: typeof item?.created_at === 'string' && item.created_at ? item.created_at : new Date().toISOString(),
      revision: Math.max(1, safeCount(item?.revision, 1)),
    }]
  })
  return mergeCampaignRetcons([], normalized)
}


export function defaultVoiceGuidedPlaySettings(): VoiceGuidedPlaySettings {
  return {
    enabled: false,
    guidance_level: 5,
    dice_preference: 'player_rolls',
  }
}

export function normalizeVoiceGuidedPlaySettings(value: Partial<VoiceGuidedPlaySettings> | null | undefined): VoiceGuidedPlaySettings {
  const fallback = defaultVoiceGuidedPlaySettings()
  const dicePreference: VoiceGuidedDicePreference = value?.dice_preference === 'aigm_rolls' || value?.dice_preference === 'ask_each_time'
    ? value.dice_preference
    : 'player_rolls'
  const level = typeof value?.guidance_level === 'number' && Number.isFinite(value.guidance_level)
    ? Math.max(1, Math.min(10, Math.round(value.guidance_level)))
    : fallback.guidance_level
  return {
    enabled: Boolean(value?.enabled),
    guidance_level: level,
    dice_preference: dicePreference,
  }
}

export function emptyGameplayState(): GameplayState {
  return {
    messages: [],
    transcript: [],
    campaign_summary: '',
    scene: '',
    turn_count: 0,
    combat_active: false,
    initiative: [],
    vtt_setup: null,
    dice_mode: 'cheat',
    dm_secrets: emptyDmSecretsState(),
    memory_index: [],
    retcons: [],
    pending_level_ups: [],
  }
}

export function normalizePlayName(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_PLAY_NAME_LENGTH)
}

export function inferPlayName(result: CharacterIntakeResult) {
  const fullName = result.character.name.trim().replace(TITLE_WORDS, '')
  const firstWord = fullName.split(/\s+/).find(Boolean) ?? ''
  const alias = result.character.aliases_and_nicknames
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 0 && entry.length <= MAX_PLAY_NAME_LENGTH)

  if (firstWord && firstWord.length <= MAX_PLAY_NAME_LENGTH) return firstWord
  if (alias) return alias
  return normalizePlayName(firstWord || result.character.name || 'Hero') || 'Hero'
}

export function playNameFor(character: Pick<StoredPartyCharacter, 'playName' | 'result'>) {
  if (character.playName.trim()) return character.playName.trim()
  if (character.result) return inferPlayName(character.result)
  return 'Hero'
}

export function adventureStorageKey(adventureId: string) {
  return `${ADVENTURE_PREFIX}${adventureId}`
}

export function fallbackAdventureStorageKey(adventureId: string) {
  return `${FALLBACK_ADVENTURE_PREFIX}${adventureId}`
}

function settingsKey(settings: CharacterIntakeSettings) {
  const ruleset = (settings.ruleset || 'D&D 5.5e (2024 rules)').trim().toLocaleLowerCase('en-US').replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '')
  return `${settings.campaign_start_mode}:${settings.dont_sweat_small_stuff ? 'small-stuff-on' : 'small-stuff-off'}:${ruleset || 'dnd-5.5e-2024-rules'}`
}

export function characterCachePrefixForAdventure(adventureId: string) {
  return `${CHARACTER_CACHE_PREFIX}${adventureId}:`
}

export function characterCacheKey(
  adventureId: string,
  fingerprint: string,
  settings: CharacterIntakeSettings,
  contentMode: AiContentMode = 'standard',
) {
  return `${characterCachePrefixForAdventure(adventureId)}${fingerprint}:${settingsKey(settings)}:${contentMode}`
}

function normalizeAdvancementProfile(value: unknown, knownClasses: Array<{ name: string; subclass: string }> = []): CharacterAdvancementProfile | undefined {
  if (!value || typeof value !== 'object') return undefined
  const source = value as Partial<CharacterAdvancementProfile>
  const title = safeShortText(source.title, 180)
  const className = safeShortText(source.class_name, 120)
  if (!title || !className || !Array.isArray(source.levels)) return undefined
  const levels = source.levels.flatMap((entry) => {
    const row = entry as Partial<AdvancementLevelRow> | null
    const level = safeCount(row?.level)
    if (level < 1 || level > 20) return []
    const progressionValues = Array.isArray(row?.progression_values)
      ? row!.progression_values!.flatMap((value) => {
          const item = value as Partial<AdvancementProgressionValue> | null
          const name = safeShortText(item?.name, 100)
          const shown = safeShortText(item?.value, 100)
          return name && shown ? [{ name, value: shown }] : []
        }).slice(0, 24)
      : []
    const spellSlots = Array.isArray(row?.spell_slots)
      ? row!.spell_slots!.flatMap((value) => {
          const item = value as Partial<AdvancementSpellSlotValue> | null
          const slotLevel = safeShortText(item?.level, 30)
          const total = safeShortText(item?.total, 30)
          return slotLevel && total ? [{ level: slotLevel, total }] : []
        }).slice(0, 12)
      : []
    const featureDetails = Array.isArray(row?.feature_details)
      ? row!.feature_details!.flatMap((value) => {
          const item = value as Partial<AdvancementFeatureDetail> | null
          const name = safeShortText(item?.name, 160)
          const text = typeof item?.text === 'string' ? item.text.trim().slice(0, 6000) : ''
          return name && text ? [{ name, text }] : []
        }).slice(0, 24)
      : []
    return [{
      level,
      proficiency_bonus: safeShortText(row?.proficiency_bonus, 30),
      features: normalizedStringList(row?.features, 24, 160),
      feature_details: featureDetails,
      progression_values: progressionValues,
      spell_slots: spellSlots,
    }]
  }).sort((left, right) => left.level - right.level)
  if (levels.length === 0) return undefined
  const suppliedKind = source.profile_kind === 'subclass' ? 'subclass' : source.profile_kind === 'class' ? 'class' : ''
  const legacySubclass = !suppliedKind ? knownClasses.find((entry) => {
    const classMatches = entry.name.trim().toLocaleLowerCase('en-US') === className.trim().toLocaleLowerCase('en-US')
    const subclass = entry.subclass.replace(/\s+/g, ' ').trim()
    if (!classMatches || !subclass) return false
    const haystack = `${title} ${safeShortText(source.source_name, 180)}`.toLocaleLowerCase('en-US')
    return haystack.includes(subclass.toLocaleLowerCase('en-US'))
  })?.subclass.replace(/\s+/g, ' ').trim() : ''
  const profileKind = suppliedKind || (legacySubclass ? 'subclass' : 'class')
  const suppliedHitPointDie = Number(source.hit_point_die)
  const hitPointDie = profileKind === 'class' && Number.isInteger(suppliedHitPointDie) && suppliedHitPointDie >= 2 && suppliedHitPointDie <= 100
    ? suppliedHitPointDie
    : undefined
  return {
    title,
    class_name: className,
    ruleset: safeShortText(source.ruleset, 140),
    source_name: safeShortText(source.source_name, 180),
    profile_kind: profileKind,
    subclass_name: profileKind === 'subclass' ? (safeShortText(source.subclass_name, 140) || legacySubclass) : '',
    ...(hitPointDie ? { hit_point_die: hitPointDie } : {}),
    levels,
    warnings: normalizedStringList(source.warnings, 20, 260),
  }
}

function normalizeClassRecords(value: unknown, knownClasses: Array<{ name: string; level?: number }> = []): CharacterClassRecord[] {
  if (!Array.isArray(value)) return []
  const known = new Map(knownClasses.map((entry) => [entry.name.trim().toLocaleLowerCase('en-US'), Number(entry.level) || 20] as const).filter(([name]) => Boolean(name)))
  return value.flatMap((entry) => {
    const source = entry as Partial<CharacterClassRecord> | null
    const className = safeShortText(source?.class_name, 120)
    if (!className || !Array.isArray(source?.levels)) return []
    const knownLevel = known.get(className.toLocaleLowerCase('en-US'))
    if (known.size > 0 && knownLevel === undefined) return []
    const suppliedDie = Number(source?.hit_point_die)
    const hitPointDie = Number.isInteger(suppliedDie) && suppliedDie >= 2 && suppliedDie <= 100 ? suppliedDie : undefined
    const levels = source!.levels!.flatMap((entry) => {
      const row = entry as Partial<CharacterClassLevelHistory> | null
      const classLevel = safeCount(row?.class_level)
      const totalLevel = safeCount(row?.total_character_level)
      if (classLevel < 1 || classLevel > 20 || totalLevel < 1 || totalLevel > 20 || (knownLevel !== undefined && classLevel > knownLevel)) return []
      const gained = Number(row?.hit_points_gained)
      const method = row?.hit_point_method === 'roll' || row?.hit_point_method === 'fixed' || row?.hit_point_method === 'other' || row?.hit_point_method === 'imported' ? row.hit_point_method : undefined
      return [{
        class_level: classLevel,
        total_character_level: totalLevel,
        ...(Number.isInteger(gained) && gained >= 0 && gained <= 1000 ? { hit_points_gained: gained } : {}),
        ...(method ? { hit_point_method: method } : {}),
        automatic_changes: normalizedStringList(row?.automatic_changes, 30, 220),
        choices: Array.isArray(row?.choices) ? row!.choices!.flatMap((item) => {
          const choice = item as Partial<CharacterClassLevelChoice> | null
          const label = safeShortText(choice?.label, 160)
          const shown = safeShortText(choice?.value, 600)
          return label && shown ? [{ label, value: shown }] : []
        }).slice(0, 24) : [],
        class_feature_names: normalizedStringList(row?.class_feature_names, 24, 160),
        subclass_name: safeShortText(row?.subclass_name, 140),
        subclass_feature_names: normalizedStringList(row?.subclass_feature_names, 24, 160),
        progression_values: Array.isArray(row?.progression_values) ? row!.progression_values!.flatMap((item) => {
          const value = item as Partial<AdvancementProgressionValue> | null
          const name = safeShortText(value?.name, 100)
          const shown = safeShortText(value?.value, 100)
          return name && shown ? [{ name, value: shown }] : []
        }).slice(0, 24) : [],
        recorded_at: safeShortText(row?.recorded_at, 80) || new Date(0).toISOString(),
      }]
    }).sort((left, right) => left.total_character_level - right.total_character_level || left.class_level - right.class_level)
    if (levels.length === 0) return []
    return [{ class_name: className, ...(hitPointDie ? { hit_point_die: hitPointDie } : {}), levels }]
  }).slice(0, 20)
}

function normalizeStoredCharacter(character: Partial<StoredPartyCharacter>): StoredPartyCharacter | null {
  if (!character.id || !character.sourceFileName) return null
  let result = character.result ? normalizeCharacterIntakeResult(character.result) : null
  const starterId = typeof character.starterId === 'string' ? character.starterId.slice(0, 40) : ''
  const migrateStarterFighterAlignment = Boolean(
    result && starterId === 'wardens-pc-starter-fighter' && /^Neutral Evil$/i.test(result.character.alignment.trim()),
  )
  if (result && migrateStarterFighterAlignment) {
    result = { ...result, character: { ...result.character, alignment: 'Neutral Good' } }
  }
  const storedSourceText = typeof character.sourceText === 'string' ? character.sourceText.slice(0, 120_000) : ''
  const sourceText = migrateStarterFighterAlignment
    ? storedSourceText.replace(/^(Alignment:\s*)Neutral Evil$/im, '$1Neutral Good')
    : storedSourceText
  const advancementProfiles = Array.isArray(character.advancementProfiles)
    ? character.advancementProfiles.map((profile) => normalizeAdvancementProfile(profile, result?.character.classes ?? [])).filter((profile): profile is CharacterAdvancementProfile => Boolean(profile)).slice(0, 12)
    : []
  if (result) result = canonicalizeCharacterRecord(result, advancementProfiles)

  return {
    id: character.id,
    sourceFileName: character.sourceFileName,
    fileFingerprint: character.fileFingerprint ?? '',
    status: character.status ?? 'error',
    result,
    model: character.model ?? null,
    conversation: Array.isArray(character.conversation) ? character.conversation : [],
    error: character.error ?? null,
    playName: normalizePlayName(character.playName ?? (result ? inferPlayName(result) : '')),
    liveState: result ? normalizeLiveState(character.liveState, result) : undefined,
    sourceText,
    sourceMimeType: typeof character.sourceMimeType === 'string' ? character.sourceMimeType.slice(0, 120) : '',
    portraitUrl: typeof character.portraitUrl === 'string' ? character.portraitUrl.slice(0, 900_000) : '',
    starterId,
    advancementProfiles,
    classRecords: normalizeClassRecords(character.classRecords, result?.character.classes ?? []),
  }
}

function normalizedMessages(value: unknown, legacy = false): GameplayMessage[] {
  if (!Array.isArray(value)) return []
  let nextSequence = 1
  return value
    .filter((message) => message && (message.role === 'user' || message.role === 'assistant') && typeof message.text === 'string')
    .map((message) => {
      const savedSequence = typeof message.sequence === 'number' && Number.isFinite(message.sequence)
        ? Math.max(1, Math.floor(message.sequence))
        : nextSequence
      const sequence = Math.max(nextSequence, savedSequence)
      nextSequence = sequence + 1
      return {
        id: typeof message.id === 'string' && message.id ? message.id : crypto.randomUUID(),
        role: message.role,
        text: message.text,
        created_at: typeof message.created_at === 'string' ? message.created_at : new Date().toISOString(),
        sequence,
        turn_number: legacy
          ? null
          : typeof message.turn_number === 'number' && Number.isFinite(message.turn_number)
            ? Math.max(0, Math.floor(message.turn_number))
            : null,
        exchange_id: legacy ? null : typeof message.exchange_id === 'string' && message.exchange_id ? message.exchange_id : null,
      }
    })
}

function normalizeGameplayState(value: Partial<GameplayState> | null | undefined, legacy = false): GameplayState {
  const fallback = emptyGameplayState()
  if (!value) return fallback

  const savedMessages = normalizedMessages(value.messages, legacy)
  const transcript = normalizedMessages(value.transcript, legacy)
  const completeTranscript = transcript.length > 0 ? transcript : savedMessages

  return {
    messages: completeTranscript.slice(-120),
    transcript: completeTranscript,
    campaign_summary: typeof value.campaign_summary === 'string' ? value.campaign_summary : '',
    scene: typeof value.scene === 'string' ? value.scene : '',
    turn_count: typeof value.turn_count === 'number' && Number.isFinite(value.turn_count) ? Math.max(0, Math.floor(value.turn_count)) : 0,
    combat_active: Boolean(value.combat_active),
    vtt_setup: normalizeVttSetup(value.vtt_setup),
    dice_mode: value.dice_mode === 'purist' ? 'purist' : 'cheat',
    dm_secrets: normalizeDmSecrets(value.dm_secrets),
    memory_index: normalizeMemoryIndex(value.memory_index),
    retcons: normalizeRetcons(value.retcons),
    pending_level_ups: normalizedStringList(value.pending_level_ups, 6, 120),
    initiative: Array.isArray(value.initiative)
      ? value.initiative
        .filter((entry) => entry && typeof entry.character_id === 'string')
        .map((entry) => ({
          character_id: entry.character_id,
          entity_type: entry.entity_type === 'npc' ? 'npc' as const : 'player' as const,
          name: typeof entry.name === 'string' ? entry.name : 'Hero',
          modifier: Number.isFinite(entry.modifier) ? entry.modifier : 0,
          roll: Number.isFinite(entry.roll) ? entry.roll : 0,
          total: Number.isFinite(entry.total) ? entry.total : 0,
        }))
        .sort((left, right) => right.total - left.total || right.modifier - left.modifier)
      : [],
  }
}


function loreFidelityFromSetupAnswers(answers: unknown) {
  if (!Array.isArray(answers)) return 7
  let finalAnswer: string | null = null
  for (let index = answers.length - 1; index >= 0; index -= 1) {
    const entry = answers[index]
    if (typeof entry === 'string' && /(?:^|\n)Setting:/i.test(entry)) {
      finalAnswer = entry
      break
    }
  }
  const match = finalAnswer?.match(/Published lore fidelity:\s*(10|[1-9])\s*(?:\/\s*10|out\s+of\s+10)/i) ?? null
  return match ? Number(match[1]) : 7
}

export function normalizeAdventureState(value: unknown): SavedAdventureState | null {
  try {
    const parsed = value as Omit<Partial<SavedAdventureState>, 'storage_schema'> & { storage_schema?: number }
    const legacy = parsed?.storage_schema === LEGACY_ADVENTURE_STORAGE_SCHEMA
    const savedVersion = String((parsed as { version?: unknown }).version ?? '')
    const savedRevision = String((parsed as { analysis_revision?: unknown }).analysis_revision ?? '')
    const currentCharacterRecord = savedVersion === CHARACTER_INTAKE_VERSION && savedRevision === CHARACTER_INTAKE_ANALYSIS_REVISION
    const migratable411CharacterRecord = savedVersion === '1.4' && savedRevision === 'character-onboarding-1.4-party-v1'
    if (
      (!legacy && parsed?.storage_schema !== ADVENTURE_STORAGE_SCHEMA) ||
      (!currentCharacterRecord && !migratable411CharacterRecord) ||
      !parsed.adventure_id ||
      !Array.isArray(parsed.characters)
    ) {
      return null
    }

    let characters = parsed.characters
      .map((character) => normalizeStoredCharacter(character))
      .filter((character): character is StoredPartyCharacter => Boolean(character))

    const activeLeaderCount = characters.filter((character) => character.status === 'ready' && character.result?.character.is_current_party_active_leader === true).length
    if (activeLeaderCount > 1) {
      // Corrupt or legacy data must not silently manufacture a leader. Clear the
      // conflict and let the player establish one later through the normal UI.
      characters = characters.map((character) => character.result ? {
        ...character,
        result: {
          ...character.result,
          character: { ...character.result.character, is_current_party_active_leader: false },
        },
      } : character)
    }

    return {
      storage_schema: ADVENTURE_STORAGE_SCHEMA,
      version: CHARACTER_INTAKE_VERSION,
      analysis_revision: CHARACTER_INTAKE_ANALYSIS_REVISION,
      character_record_migration: parsed.character_record_migration === 'needs_srd_enrichment'
        || (migratable411CharacterRecord && parsed.character_record_migration !== 'complete')
        ? 'needs_srd_enrichment'
        : 'complete',
      adventure_id: parsed.adventure_id,
      adventure_name: canonicalAdventureName(parsed.adventure_name || ''),
      campaign_mode: parsed.campaign_mode === 'multiplayer' ? 'multiplayer' : 'solo',
      multiplayer_administration: parsed.multiplayer_administration === 'coordinator' ? 'coordinator' : 'shared',
      game_master_name: typeof parsed.game_master_name === 'string' ? parsed.game_master_name.trim().slice(0, 40) : '',
      campaign_direction: parsed.campaign_direction === 'mostly_open' || parsed.campaign_direction === 'strong_arc' ? parsed.campaign_direction : 'gentle_story',
      campaign_scale: parsed.campaign_scale === 'grounded' || parsed.campaign_scale === 'occasionally_strange' || parsed.campaign_scale === 'cosmic' ? parsed.campaign_scale : 'epic',
      lore_fidelity: Number.isFinite(parsed.lore_fidelity) ? Math.max(1, Math.min(10, Math.floor(parsed.lore_fidelity ?? 7))) : loreFidelityFromSetupAnswers(parsed.setup_answers),
      content_mode: normalizeAiContentMode(parsed.content_mode),
      imported_content_mode: parsed.imported_content_mode === 'standard' || parsed.imported_content_mode === 'teen-appropriate'
        ? normalizeAiContentMode(parsed.imported_content_mode)
        : null,
      content_mode_import_mismatch: Boolean(parsed.content_mode_import_mismatch),
      content_mode_explanation_given: Boolean(parsed.content_mode_explanation_given),
      created_at: parsed.created_at || new Date().toISOString(),
      updated_at: parsed.updated_at || new Date().toISOString(),
      settings: {
        campaign_start_mode: parsed.settings?.campaign_start_mode === 'continuing' ? 'continuing' : 'new_fully_rested',
        dont_sweat_small_stuff: parsed.settings?.dont_sweat_small_stuff !== false,
        ruleset: typeof parsed.settings?.ruleset === 'string' && parsed.settings.ruleset.trim()
          ? parsed.settings.ruleset.trim()
          : 'D&D 5.5e (2024 rules)',
      },
      characters,
      setup_answers: migrateSetupAnswers(parsed.setup_answers, parsed.stage ?? 'party'),
      setup_conversation: Array.isArray(parsed.setup_conversation) ? parsed.setup_conversation : [],
      general_conversation: Array.isArray(parsed.general_conversation) ? parsed.general_conversation : [],
      stage: parsed.stage ?? 'party',
      gameplay: normalizeGameplayState(parsed.gameplay, legacy),
      starter_defaults_seeded: Boolean(parsed.starter_defaults_seeded),
      party_choice_confirmed: Boolean(parsed.party_choice_confirmed) || (parsed.stage ?? 'party') !== 'party',
      voice_guided_play: normalizeVoiceGuidedPlaySettings(parsed.voice_guided_play),
      character_assistance_level: typeof parsed.character_assistance_level === 'number' && Number.isFinite(parsed.character_assistance_level)
        ? Math.max(1, Math.min(10, Math.round(parsed.character_assistance_level)))
        : 5,
    }
  } catch {
    return null
  }
}

export function parseAdventureState(raw: string | null): SavedAdventureState | null {
  if (!raw) return null
  try {
    return normalizeAdventureState(JSON.parse(raw))
  } catch {
    return null
  }
}

export function readAdventureIndex(storage: Storage): AdventureSummary[] {
  try {
    const parsed = JSON.parse(storage.getItem(ADVENTURE_INDEX_KEY) || '[]') as AdventureSummary[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((entry) => entry?.adventure_id)
      .map((entry) => ({ ...entry, adventure_name: canonicalAdventureName(entry.adventure_name || '') }))
      .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
  } catch {
    return []
  }
}

export function saveAdventureStateToLocalStorage(storage: Storage, state: SavedAdventureState, preserveLegacy = false) {
  const key = preserveLegacy ? fallbackAdventureStorageKey(state.adventure_id) : adventureStorageKey(state.adventure_id)
  storage.setItem(key, JSON.stringify(state))
  storage.setItem(CURRENT_ADVENTURE_KEY, state.adventure_id)

  const summary: AdventureSummary = {
    adventure_id: state.adventure_id,
    adventure_name: canonicalAdventureName(state.adventure_name),
    campaign_mode: state.campaign_mode ?? 'solo',
    campaign_administration: state.campaign_mode === 'multiplayer' ? (state.multiplayer_administration ?? 'shared') : 'solo',
    updated_at: state.updated_at,
    stage: state.stage,
    party_names: state.characters
      .filter((character) => character.result)
      .map((character) => playNameFor(character)),
  }
  const index = readAdventureIndex(storage).filter((entry) => entry.adventure_id !== state.adventure_id)
  storage.setItem(ADVENTURE_INDEX_KEY, JSON.stringify([summary, ...index]))
}

export function deleteAdventureStateFromLocalStorage(storage: Storage, adventureId: string) {
  storage.removeItem(adventureStorageKey(adventureId))
  storage.removeItem(fallbackAdventureStorageKey(adventureId))
  storage.removeItem(`${ADVENTURE_MIGRATION_PREFIX}${adventureId}`)
  const index = readAdventureIndex(storage).filter((entry) => entry.adventure_id !== adventureId)
  storage.setItem(ADVENTURE_INDEX_KEY, JSON.stringify(index))
  if (storage.getItem(CURRENT_ADVENTURE_KEY) === adventureId) {
    storage.removeItem(CURRENT_ADVENTURE_KEY)
  }
}

export function clearCharacterCacheForAdventure(storage: Storage, adventureId: string) {
  const prefix = characterCachePrefixForAdventure(adventureId)
  const keys: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key?.startsWith(prefix)) keys.push(key)
  }
  keys.forEach((key) => storage.removeItem(key))
  return keys.length
}

export function clearAllCharacterCaches(storage: Storage) {
  const keys: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key?.startsWith(CHARACTER_CACHE_PREFIX)) keys.push(key)
  }
  keys.forEach((key) => storage.removeItem(key))
  return keys.length
}
