import type { CharacterAdvancementProfile } from '@/lib/aigm/campaign-storage'
import { canonicalizeCharacterRecord, characterFeatureEntries, normalizedRecordName } from './character-record'
import type { CharacterIntakeResult } from '@/lib/aigm/types'

export interface SavedRuleEnrichment {
  result: CharacterIntakeResult
  added: string[]
  expanded: string[]
  unresolved: string[]
}

function cleanProfiles(value: unknown): CharacterAdvancementProfile[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const source = entry as Partial<CharacterAdvancementProfile>
    const className = typeof source.class_name === 'string' ? source.class_name.replace(/\s+/g, ' ').trim().slice(0, 120) : ''
    if (!className || !Array.isArray(source.levels)) return []
    const levels = source.levels.flatMap((row) => {
      if (!row || typeof row !== 'object') return []
      const level = Number(row.level)
      if (!Number.isInteger(level) || level < 1 || level > 20) return []
      const features = Array.isArray(row.features)
        ? row.features.map((item) => typeof item === 'string' ? item.replace(/\s+/g, ' ').trim().slice(0, 160) : '').filter(Boolean).slice(0, 24)
        : []
      const featureDetails = Array.isArray(row.feature_details)
        ? row.feature_details.flatMap((item) => {
            if (!item || typeof item !== 'object') return []
            const name = typeof item.name === 'string' ? item.name.replace(/\s+/g, ' ').trim().slice(0, 160) : ''
            const text = typeof item.text === 'string' ? item.text.trim().slice(0, 6000) : ''
            return name && text ? [{ name, text }] : []
          }).slice(0, 24)
        : []
      const progressionValues = Array.isArray(row.progression_values)
        ? row.progression_values.flatMap((item) => {
            if (!item || typeof item !== 'object') return []
            const name = typeof item.name === 'string' ? item.name.replace(/\s+/g, ' ').trim().slice(0, 100) : ''
            const shown = typeof item.value === 'string' ? item.value.replace(/\s+/g, ' ').trim().slice(0, 100) : ''
            return name && shown ? [{ name, value: shown }] : []
          }).slice(0, 24)
        : []
      const spellSlots = Array.isArray(row.spell_slots)
        ? row.spell_slots.flatMap((item) => {
            if (!item || typeof item !== 'object') return []
            const slotLevel = typeof item.level === 'string' ? item.level.replace(/\s+/g, ' ').trim().slice(0, 30) : ''
            const total = typeof item.total === 'string' ? item.total.replace(/\s+/g, ' ').trim().slice(0, 30) : ''
            return slotLevel && total ? [{ level: slotLevel, total }] : []
          }).slice(0, 12)
        : []
      return [{
        level,
        proficiency_bonus: typeof row.proficiency_bonus === 'string' ? row.proficiency_bonus.trim().slice(0, 30) : '',
        features,
        feature_details: featureDetails,
        progression_values: progressionValues,
        spell_slots: spellSlots,
      }]
    }).sort((a, b) => a.level - b.level)
    if (!levels.length) return []
    return [{
      title: typeof source.title === 'string' ? source.title.slice(0, 180) : `${className} advancement`,
      class_name: className,
      ruleset: typeof source.ruleset === 'string' ? source.ruleset.slice(0, 140) : '',
      source_name: typeof source.source_name === 'string' ? source.source_name.slice(0, 180) : '',
      ...(source.profile_kind === 'subclass' || source.profile_kind === 'class' ? { profile_kind: source.profile_kind } : {}),
      subclass_name: typeof source.subclass_name === 'string' ? source.subclass_name.slice(0, 140) : '',
      ...(Number.isInteger(Number(source.hit_point_die)) ? { hit_point_die: Number(source.hit_point_die) } : {}),
      levels,
      warnings: Array.isArray(source.warnings) ? source.warnings.map((item) => typeof item === 'string' ? item.replace(/\s+/g, ' ').trim().slice(0, 260) : '').filter(Boolean).slice(0, 20) : [],
    }]
  }).slice(0, 12)
}

export function compactSavedAdvancementProfiles(value: unknown) {
  return cleanProfiles(value)
}

export function enrichFromSavedCharacterRules(result: CharacterIntakeResult, profileInput: unknown): SavedRuleEnrichment {
  const profiles = cleanProfiles(profileInput)
  const before = characterFeatureEntries(result)
  const normalized = canonicalizeCharacterRecord(result, profiles)
  const after = characterFeatureEntries(normalized)
  const beforeByName = new Map(before.map((entry) => [normalizedRecordName(entry.name), entry]))
  const added = after.filter((entry) => !beforeByName.has(normalizedRecordName(entry.name))).map((entry) => entry.name)
  const expanded = after.filter((entry) => {
    const prior = beforeByName.get(normalizedRecordName(entry.name))
    return Boolean(prior && entry.detail.length > prior.detail.length)
  }).map((entry) => entry.name)
  const unresolved = after.filter((entry) => !entry.detail).map((entry) => entry.name)
  return {
    result: normalized,
    added: Array.from(new Set(added)),
    expanded: Array.from(new Set(expanded)),
    unresolved: Array.from(new Set(unresolved)),
  }
}
