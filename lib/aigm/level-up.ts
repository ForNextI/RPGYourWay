import type { CharacterAdvancementProfile } from '@/lib/aigm/campaign-storage'

export type LevelUpSourceKind = 'supported_srd' | 'player_profile' | 'needs_profile'

export type LevelUpChoiceKind = 'other' | 'spellbook' | 'prepared_spell' | 'known_spell' | 'cantrip'

export interface LevelUpChoicePrompt {
  id: string
  label: string
  help: string
  required: boolean
  options: string[]
  choice_kind: LevelUpChoiceKind
  selection_count: number
}

export interface LevelUpSrdSpellOption {
  name: string
  level: number
}

export interface LevelUpSpellChangeGuidance {
  level_one_plus_change: 'none' | 'one' | 'any'
  cantrip_replacement: boolean
  replacement_source: 'class_list' | 'spellbook'
  list_label: 'prepared' | 'known' | 'prepared or known'
}

export interface LevelUpPlan {
  can_proceed: boolean
  needs_advancement_profile: boolean
  source_kind: LevelUpSourceKind
  source_label: string
  advancing_class: string
  /** True when this level is the character's first level in a second/new class. */
  is_new_class?: boolean
  current_class_level?: number
  target_total_level: number
  target_class_level: number
  proficiency_bonus: string
  automatic_changes: string[]
  feature_names: string[]
  /** RPG Your Way-classified names used by the record accordions and advancement ledger. */
  class_feature_names?: string[]
  subclass_feature_names?: string[]
  progression_values: Array<{ name: string; value: string }>
  spell_slots: Array<{ level: string; total: string }>
  choices: LevelUpChoicePrompt[]
  warnings: string[]
  hit_point_die?: number
  fixed_hit_point_gain?: number
  srd_spell_catalog?: LevelUpSrdSpellOption[]
  srd_replacement_cantrips?: LevelUpSrdSpellOption[]
  srd_spell_max_level?: number
  spell_change_guidance?: LevelUpSpellChangeGuidance
  /** Added by RPG Your Way after the model plan is cleaned. */
  subclass_required?: boolean
  subclass_name?: string
  subclass_options?: string[]
  needs_subclass_advancement_profile?: boolean
  subclass_source_label?: string
}

export interface AdvancementProfileApiResponse {
  profile?: CharacterAdvancementProfile
  model?: string
  request_id?: string
  error?: string
  details?: string
}

export interface LevelUpPlanApiResponse {
  plan?: LevelUpPlan
  model?: string
  request_id?: string
  error?: string
  details?: string
}
