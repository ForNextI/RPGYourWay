export type IntakeConfidence = 'high' | 'medium' | 'low'
export type QuestionPriority = 'required' | 'important' | 'optional'
export type FactVisibility = 'public' | 'party_known' | 'probably_private' | 'unknown'
export type CampaignStartMode = 'new_fully_rested' | 'continuing'
export type IntakeDocumentKind = 'dnd_beyond_character_sheet' | 'other_character_sheet' | 'not_character_sheet' | 'unreadable'

export interface CharacterIntakeSettings {
  campaign_start_mode: CampaignStartMode
  dont_sweat_small_stuff: boolean
  /** Ruleset/system selected before Character Intake. Built-ins use their public label; Other stores the player-supplied system name. */
  ruleset: string
}

export interface CharacterClassEntry {
  name: string
  level: number
  subclass: string
}

export interface AbilityScores {
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
}

export interface HitPointState {
  maximum: number
  current_shown_on_sheet: number
  temporary_shown_on_sheet: number
}

export interface OpeningState {
  campaign_start_mode: CampaignStartMode
  fully_rested_defaults_applied: boolean
  current_hit_points: number
  temporary_hit_points: number
  condition_notes: string[]
  resource_state: string
  standard_adventuring_setup: string
  setup_confirmed: boolean
}

export interface AttackEntry {
  name: string
  attack_bonus: string
  damage: string
  properties: string[]
}

export interface EquipmentEntry {
  name: string
  quantity: string
  sheet_status: string
}

export interface ResourceEntry {
  name: string
  maximum_or_frequency: string
  current_shown_on_sheet: string
}

export type CharacterFeatureCategory = 'class' | 'subclass' | 'species' | 'feat' | 'background' | 'item' | 'other'

/**
 * Build 4.12 canonical feature record. Older saves used one display string for
 * both the feature name and its rules; migration separates the two here.
 */
export interface CharacterFeatureEntry {
  id: string
  name: string
  detail: string
  category: CharacterFeatureCategory
  class_name: string
  subclass_name: string
  level_gained: number
  source: string
}

export interface CharacterProficiencies {
  armor: string[]
  shields: string[]
  weapons: string[]
  tools: string[]
  vehicles: string[]
  gaming_sets: string[]
  musical_instruments: string[]
  other_training: string[]
}

export interface CharacterBiography {
  appearance: string
  faith: string
  place_of_origin: string
  current_residence: string
  size: string
  height: string
  weight: string
}

export interface CurrencyState {
  cp: number
  sp: number
  ep: number
  gp: number
  pp: number
  total_gp_value: number
}

export interface ValuableEntry {
  name: string
  quantity: string
  value_each_gp: string
  estimated_total_gp: string
}

export interface SpellSlotEntry {
  level: string
  total_shown: string
  used_shown: string
}

export interface StoryFactEntry {
  fact: string
  likely_visibility: FactVisibility
}

export interface IntakeIssue {
  category: string
  issue: string
  why_it_matters: string
}

export interface ClarificationQuestion {
  priority: QuestionPriority
  question: string
  reason: string
}

export interface CharacterIntakeResult {
  document_assessment: {
    kind: IntakeDocumentKind
    is_usable: boolean
    reason: string
  }
  assistant_message: string
  confidence: IntakeConfidence
  intake_settings: CharacterIntakeSettings
  opening_state: OpeningState
  applied_assumptions: string[]
  player_corrections: string[]
  character: {
    name: string
    sex: string
    pronouns: string
    age: string
    alignment: string
    species: string
    background: string
    classes: CharacterClassEntry[]
    total_level: number
    armor_class: number
    initiative_modifier: number
    hit_points: HitPointState
    speed: string
    proficiency_bonus: string
    ability_scores: AbilityScores
    saving_throws: string[]
    skills: string[]
    senses: string[]
    languages: string[]
    attacks: AttackEntry[]
    armor_and_shields: EquipmentEntry[]
    equipment_highlights: EquipmentEntry[]
    currency: CurrencyState
    valuables: ValuableEntry[]
    resources: ResourceEntry[]
    spellcasting: {
      ability: string
      save_dc: string
      attack_bonus: string
      slots: SpellSlotEntry[]
      cantrips: string[]
      prepared_or_known_spells: string[]
      spellbook_or_other_spells: string[]
    }
    /** Build 4.12 canonical features. */
    features?: CharacterFeatureEntry[]
    /** Legacy Build 4.11 feature strings, consumed and removed during migration. */
    feats_and_features?: string[]
    proficiencies?: CharacterProficiencies
    biography?: CharacterBiography
    aliases_and_nicknames: string[]
    story_facts: StoryFactEntry[]
    personality_goals_and_fears: string[]
    relationships_and_organizations: string[]
    /** True only for the one character currently selected as the active party leader. */
    is_current_party_active_leader: boolean
  }
  sheet_summary: string[]
  detected_issues: IntakeIssue[]
  clarification_questions: ClarificationQuestion[]
  details_not_found: string[]
  additional_details: string[]
}

export interface CharacterIntakeApiResponse {
  result: CharacterIntakeResult
  model: string
  request_id: string
  intake_version: '1.5'
  analysis_revision: 'character-onboarding-1.5-record-v2'
  source_text?: string
}

export interface CharacterIntakeApiError {
  error: string
  details?: string
  request_id?: string
}

export interface CharacterEditProposal {
  assistant_message: string
  can_save: boolean
  change_summary: string[]
  duplicate_warnings: string[]
  blocking_questions: string[]
  proposed_play_name: string
  proposed_result: CharacterIntakeResult
}

export interface CharacterEditApiResponse extends CharacterEditProposal {
  model: string
  request_id: string
}
