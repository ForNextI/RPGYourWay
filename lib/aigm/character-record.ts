import { dnd55ClassFeatureNamesThroughLevel, dnd55SubclassFeatureNamesThroughLevel } from './multiclassing'
import type {
  CharacterBiography,
  CharacterFeatureCategory,
  CharacterFeatureEntry,
  CharacterIntakeResult,
  CharacterProficiencies,
} from '@/lib/aigm/types'

interface AdvancementProfileLike {
  class_name?: string
  subclass_name?: string
  profile_kind?: 'class' | 'subclass'
  levels?: Array<{
    level?: number
    features?: string[]
    feature_details?: Array<{ name?: string; text?: string }>
  }>
}

const EMPTY_PROFICIENCIES: CharacterProficiencies = {
  armor: [],
  shields: [],
  weapons: [],
  tools: [],
  vehicles: [],
  gaming_sets: [],
  musical_instruments: [],
  other_training: [],
}

const EMPTY_BIOGRAPHY: CharacterBiography = {
  appearance: '',
  faith: '',
  place_of_origin: '',
  current_residence: '',
  size: '',
  height: '',
  weight: '',
}

export function normalizedRecordName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[’']/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function readable(value: unknown, maximum = 6000) {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim().slice(0, maximum)
    : ''
}

function uniqueText(values: unknown, maximum = 120, itemMaximum = 240) {
  if (!Array.isArray(values)) return []
  const seen = new Set<string>()
  return values.flatMap((raw) => {
    const value = readable(raw, itemMaximum)
    const key = normalizedRecordName(value)
    if (!key || seen.has(key)) return []
    seen.add(key)
    return [value]
  }).slice(0, maximum)
}

function splitFeatureString(value: string) {
  const clean = readable(value)
  const dash = clean.match(/^(.{1,180}?)\s+[—–]\s+(.+)$/)
  if (dash) return { name: dash[1].trim(), detail: dash[2].trim() }
  const colon = clean.match(/^([^:]{1,160}):\s+(.+)$/)
  if (colon) return { name: colon[1].trim(), detail: colon[2].trim() }
  return { name: clean, detail: '' }
}

function featureId(entry: Pick<CharacterFeatureEntry, 'name' | 'category' | 'class_name' | 'subclass_name'>) {
  const seed = [entry.category, entry.class_name, entry.subclass_name, entry.name]
    .map(normalizedRecordName)
    .filter(Boolean)
    .join('-')
    .replace(/\s+/g, '-')
    .slice(0, 180)
  return seed || 'feature'
}

function safeFeatureCategory(value: unknown): CharacterFeatureCategory {
  return value === 'class' || value === 'subclass' || value === 'species' || value === 'feat'
    || value === 'background' || value === 'item' || value === 'other'
    ? value
    : 'other'
}

function normalizedFeature(entry: Partial<CharacterFeatureEntry>): CharacterFeatureEntry | null {
  const name = readable(entry.name, 180)
  if (!name) return null
  const category = safeFeatureCategory(entry.category)
  const normalized = {
    id: readable(entry.id, 220),
    name,
    detail: readable(entry.detail),
    category,
    class_name: readable(entry.class_name, 120),
    subclass_name: readable(entry.subclass_name, 140),
    level_gained: Number.isInteger(Number(entry.level_gained))
      ? Math.max(0, Math.min(20, Number(entry.level_gained)))
      : 0,
    source: readable(entry.source, 220),
  }
  return { ...normalized, id: normalized.id || featureId(normalized) }
}

function featureMatchesName(feature: CharacterFeatureEntry, name: string) {
  return normalizedRecordName(feature.name) === normalizedRecordName(name)
}

function detailFromAdditional(additional: string[], name: string) {
  const nameKey = normalizedRecordName(name)
  if (!nameKey) return ''
  for (const entry of additional) {
    const split = splitFeatureString(entry)
    if (normalizedRecordName(split.name) === nameKey && split.detail.length >= 12) return split.detail
    const clean = readable(entry)
    if (!normalizedRecordName(clean).startsWith(`${nameKey} `)) continue
    const remainder = clean.slice(name.length).replace(/^\s*(?:[—–:-]|is\b)?\s*/i, '')
    if (remainder.length >= 12) return remainder
  }
  return ''
}

function profileFeature(profile: AdvancementProfileLike, name: string) {
  const nameKey = normalizedRecordName(name)
  for (const row of profile.levels ?? []) {
    const detail = row.feature_details?.find((entry) => normalizedRecordName(readable(entry.name)) === nameKey)
    if (detail?.text) return { level: Number(row.level) || 0, detail: readable(detail.text) }
  }
  return null
}

function inferredFeatureOwnership(
  result: CharacterIntakeResult,
  feature: CharacterFeatureEntry,
  profiles: AdvancementProfileLike[],
) {
  if (feature.category !== 'other') {
    if (feature.level_gained || (feature.category !== 'class' && feature.category !== 'subclass')) return feature
    const matchingClass = (result.character.classes ?? []).find((entry) => {
      if (feature.class_name && normalizedRecordName(entry.name) !== normalizedRecordName(feature.class_name)) return false
      const names = feature.category === 'subclass'
        ? dnd55SubclassFeatureNamesThroughLevel(entry.name, entry.subclass, entry.level)
        : dnd55ClassFeatureNamesThroughLevel(entry.name, entry.level)
      return names.some((name) => featureMatchesName(feature, name))
    })
    if (!matchingClass) return feature
    const gainedAt = Array.from({ length: matchingClass.level }, (_, index) => index + 1).find((level) => {
      const names = feature.category === 'subclass'
        ? dnd55SubclassFeatureNamesThroughLevel(matchingClass.name, matchingClass.subclass, level)
        : dnd55ClassFeatureNamesThroughLevel(matchingClass.name, level)
      return names.some((name) => featureMatchesName(feature, name))
    })
    return gainedAt ? { ...feature, level_gained: gainedAt } : feature
  }

  for (const classEntry of result.character.classes ?? []) {
    const subclassNames = dnd55SubclassFeatureNamesThroughLevel(classEntry.name, classEntry.subclass, classEntry.level)
    if (subclassNames.some((name) => featureMatchesName(feature, name))) {
      const gainedAt = Array.from({ length: classEntry.level }, (_, index) => index + 1)
        .find((level) => dnd55SubclassFeatureNamesThroughLevel(classEntry.name, classEntry.subclass, level).some((name) => featureMatchesName(feature, name)))
      return {
        ...feature,
        id: '',
        category: 'subclass' as const,
        class_name: classEntry.name,
        subclass_name: classEntry.subclass,
        level_gained: feature.level_gained || gainedAt || 0,
      }
    }
    const classNames = dnd55ClassFeatureNamesThroughLevel(classEntry.name, classEntry.level)
    if (classNames.some((name) => featureMatchesName(feature, name))) {
      const gainedAt = Array.from({ length: classEntry.level }, (_, index) => index + 1)
        .find((level) => dnd55ClassFeatureNamesThroughLevel(classEntry.name, level).some((name) => featureMatchesName(feature, name)))
      return { ...feature, id: '', category: 'class' as const, class_name: classEntry.name, level_gained: feature.level_gained || gainedAt || 0 }
    }
  }

  for (const profile of profiles) {
    const matchingRow = (profile.levels ?? []).find((row) =>
      (row.features ?? []).some((name) => featureMatchesName(feature, name)),
    )
    if (!matchingRow) continue
    const subclass = profile.profile_kind === 'subclass' || profile.subclass_name
    return {
      ...feature,
      id: '',
      category: subclass ? 'subclass' as const : 'class' as const,
      class_name: readable(profile.class_name, 120),
      subclass_name: subclass ? readable(profile.subclass_name, 140) : '',
      level_gained: Number(matchingRow.level) || feature.level_gained,
    }
  }

  return feature
}

export function characterFeatureEntries(
  result: CharacterIntakeResult,
  profileInput: unknown = [],
) {
  const profiles = Array.isArray(profileInput) ? profileInput as AdvancementProfileLike[] : []
  const supplied = Array.isArray(result.character.features)
    ? result.character.features.flatMap((entry) => normalizedFeature(entry) ?? [])
    : []
  const legacy = Array.isArray(result.character.feats_and_features)
    ? result.character.feats_and_features.flatMap((entry) => {
        const split = splitFeatureString(entry)
        return normalizedFeature({
          name: split.name,
          detail: split.detail,
          category: 'other',
          class_name: '',
          subclass_name: '',
          level_gained: 0,
          source: 'Migrated character record',
        }) ?? []
      })
    : []
  const profileFeatures = profiles.flatMap((profile) => {
    const classEntry = (result.character.classes ?? []).find((entry) =>
      normalizedRecordName(entry.name) === normalizedRecordName(readable(profile.class_name)),
    )
    if (!classEntry) return []
    const explicitSubclass = readable(profile.subclass_name, 140)
    const legacyLooksLikeSubclass = !profile.profile_kind
      && Boolean(classEntry.subclass)
      && normalizedRecordName(`${readable((profile as { title?: string }).title)} ${readable((profile as { source_name?: string }).source_name)}`)
        .includes(normalizedRecordName(classEntry.subclass))
    const isSubclass = profile.profile_kind === 'subclass' || Boolean(explicitSubclass) || legacyLooksLikeSubclass
    if (isSubclass && normalizedRecordName(explicitSubclass || classEntry.subclass) !== normalizedRecordName(classEntry.subclass)) return []
    return (profile.levels ?? []).flatMap((row) => {
      const level = Number(row.level) || 0
      if (!level || level > classEntry.level) return []
      return (row.features ?? []).flatMap((name) => {
        if (/^(?:subclass|.+ subclass)$/i.test(readable(name))) return []
        const detail = row.feature_details?.find((entry) => normalizedRecordName(readable(entry.name)) === normalizedRecordName(readable(name)))?.text
        return normalizedFeature({
          name,
          detail: readable(detail),
          category: isSubclass ? 'subclass' : 'class',
          class_name: classEntry.name,
          subclass_name: isSubclass ? classEntry.subclass : '',
          level_gained: level,
          source: 'Player-supplied advancement material',
        }) ?? []
      })
    })
  })

  const merged: CharacterFeatureEntry[] = []
  for (const candidate of [...supplied, ...legacy, ...profileFeatures]) {
    const owned = inferredFeatureOwnership(result, candidate, profiles)
    const existing = merged.find((entry) => {
      if (!featureMatchesName(entry, owned.name)) return false
      if (entry.category === 'other' || owned.category === 'other') return true
      return entry.category === owned.category
        && normalizedRecordName(entry.class_name) === normalizedRecordName(owned.class_name)
        && normalizedRecordName(entry.subclass_name) === normalizedRecordName(owned.subclass_name)
    })
    const profile = profiles.find((entry) => {
      if (owned.class_name && normalizedRecordName(readable(entry.class_name)) !== normalizedRecordName(owned.class_name)) return false
      return (entry.levels ?? []).some((row) => (row.features ?? []).some((name) => featureMatchesName(owned, name)))
    })
    const profileMatch = profileFeature(profile ?? {}, owned.name)
    const detail = [owned.detail, profileMatch?.detail ?? '', detailFromAdditional(result.additional_details ?? [], owned.name)]
      .sort((left, right) => right.length - left.length)[0]
    const resolved = normalizedFeature({
      ...owned,
      detail,
      level_gained: owned.level_gained || profileMatch?.level || 0,
    })!

    if (!existing) {
      merged.push(resolved)
      continue
    }
    if (resolved.detail.length > existing.detail.length) existing.detail = resolved.detail
    if (existing.category === 'other' && resolved.category !== 'other') {
      existing.category = resolved.category
      existing.class_name = resolved.class_name
      existing.subclass_name = resolved.subclass_name
      existing.level_gained = resolved.level_gained
      existing.id = featureId(existing)
    }
    if (!existing.source && resolved.source) existing.source = resolved.source
  }
  return merged.slice(0, 160)
}

function suppliedProficiencies(value: unknown): CharacterProficiencies {
  const source = value && typeof value === 'object' ? value as Partial<CharacterProficiencies> : {}
  return {
    armor: uniqueText(source.armor, 30, 120),
    shields: uniqueText(source.shields, 10, 120),
    weapons: uniqueText(source.weapons, 40, 160),
    tools: uniqueText(source.tools, 40, 160),
    vehicles: uniqueText(source.vehicles, 20, 160),
    gaming_sets: uniqueText(source.gaming_sets, 20, 160),
    musical_instruments: uniqueText(source.musical_instruments, 20, 160),
    other_training: uniqueText(source.other_training, 60, 300),
  }
}

function addUnique(target: string[], value: string) {
  const clean = readable(value, 300).replace(/^(?:and|plus)\s+/i, '')
  if (!clean || /^(?:none|not recorded|no\b)/i.test(clean)) return
  const key = normalizedRecordName(clean)
  if (!target.some((entry) => normalizedRecordName(entry) === key)) target.push(clean)
}

function classifyTrainingClause(proficiencies: CharacterProficiencies, clause: string) {
  const clean = clause.replace(/^\s*(?:training|proficiencies(?: and training)?(?: beyond core mechanics)?|additional training|other training|armor training(?: and shield training)?|armor and shield training|weapon training|weapon proficienc(?:y|ies)|tool proficienc(?:y|ies))\s*(?::|\bis\b|\bincludes?\b)\s*/i, '').trim()
  if (!clean || /^(?:none|no\b)/i.test(clean)) return
  if (/\barmor\b/i.test(clean)) return addUnique(proficiencies.armor, clean)
  if (/\bshields?\b/i.test(clean)) return addUnique(proficiencies.shields, clean)
  if (/\bweapons?\b/i.test(clean)) return addUnique(proficiencies.weapons, clean)
  if (/\bvehicles?\b/i.test(clean)) return addUnique(proficiencies.vehicles, clean)
  if (/\b(?:gaming|dice set|card set|dragonchess)\b/i.test(clean)) return addUnique(proficiencies.gaming_sets, clean)
  if (/\b(?:instrument|bagpipes?|lutes?|flutes?|drums?|horns?|lyres?|viols?)\b/i.test(clean)) return addUnique(proficiencies.musical_instruments, clean)
  if (/\b(?:tools?|supplies|kit)\b/i.test(clean)) return addUnique(proficiencies.tools, clean)
  addUnique(proficiencies.other_training, clean)
}

export function characterProficiencies(result: CharacterIntakeResult) {
  const proficiencies = suppliedProficiencies(result.character.proficiencies ?? EMPTY_PROFICIENCIES)
  for (const detail of result.additional_details ?? []) {
    const startsTrainingRecord = /^(?:training|proficiencies(?: and training)?(?: beyond core mechanics)?|additional training|other training|armor training|armor and shield|weapon training|weapon proficien|tool proficien)/i.test(detail.trim())
    const namedProficiency = !startsTrainingRecord
      ? Array.from(detail.matchAll(/(?:^|[.;]\s+)([A-Za-z'’ -]{1,80})\s+proficienc(?:y|ies)\b/gi))
          .map((match) => match[1].trim())
          .find((subject) => !/\b(?:is|are|grants?|has|have|no|not|additional|automatic)\b/i.test(subject)) ?? ''
      : ''
    if (!startsTrainingRecord && !namedProficiency) continue
    if (namedProficiency) {
      classifyTrainingClause(proficiencies, namedProficiency)
      continue
    }
    for (const clause of detail.split(/;|\.(?=\s+[A-Z])/).map((entry) => entry.trim()).filter(Boolean)) {
      if (/^No\b/i.test(clause)) {
        classifyTrainingClause(proficiencies, clause)
        continue
      }
      const categoryCount = [/\barmor\b/i, /\bshields?\b/i, /\bweapons?\b/i, /\bvehicles?\b/i, /\b(?:gaming|dice set|card set|dragonchess)\b/i, /\b(?:instrument|bagpipes?|lutes?|flutes?|drums?|horns?|lyres?|viols?)\b/i, /\b(?:tools?|supplies|kit)\b/i]
        .filter((pattern) => pattern.test(clause)).length
      const pieces = categoryCount > 1 ? clause.split(/,\s*/).filter(Boolean) : [clause]
      for (const piece of pieces) classifyTrainingClause(proficiencies, piece)
    }
  }
  return proficiencies
}

function firstLabeledDetail(additional: string[], label: RegExp) {
  for (const entry of additional) {
    const match = entry.match(label)
    if (!match || match.index === undefined) continue
    const remainder = entry.slice(match.index + match[0].length)
    return readable(remainder.split(/(?<=[.;])\s+(?=[A-Z][A-Za-z /-]{1,50}:)/)[0])
  }
  return ''
}

export function characterBiography(result: CharacterIntakeResult): CharacterBiography {
  const source = result.character.biography && typeof result.character.biography === 'object'
    ? result.character.biography
    : EMPTY_BIOGRAPHY
  const additional = result.additional_details ?? []
  return {
    appearance: readable(source.appearance) || firstLabeledDetail(additional, /\bAppearance\s*:\s*/i),
    faith: readable(source.faith) || firstLabeledDetail(additional, /\b(?:Faith(?: or deity| details|\/guiding philosophy)?|Faith symbol)\s*:\s*/i),
    place_of_origin: readable(source.place_of_origin) || firstLabeledDetail(additional, /\b(?:Home region or place of origin|Place of origin)\s*:\s*/i),
    current_residence: readable(source.current_residence) || firstLabeledDetail(additional, /\b(?:Current residence(?: or base)?|Current residence\/base|Former residence)\s*:\s*/i),
    size: readable(source.size, 80) || firstLabeledDetail(additional, /\bSize(?:\s*:\s*|\s+)/i),
    height: readable(source.height, 80) || firstLabeledDetail(additional, /\bHeight(?:\s*:\s*|\s+)/i),
    weight: readable(source.weight, 80) || firstLabeledDetail(additional, /\bWeight(?:\s*:\s*|\s+)/i),
  }
}

function retainedAdditionalDetail(value: string, features: CharacterFeatureEntry[]) {
  const clean = value.trim()
  if (/^Appearance\s*:/i.test(clean)) return ''
  if (/^(?:training|proficiencies(?: and training)?(?: beyond core mechanics)?|additional training|other training|armor training|armor and shield|weapon training|weapon proficien|tool proficien)/i.test(clean)) return ''
  const split = splitFeatureString(clean)
  if (split.detail && features.some((feature) => featureMatchesName(feature, split.name))) return ''
  const cleanKey = normalizedRecordName(clean)
  if (features.some((feature) => feature.detail && cleanKey.startsWith(`${normalizedRecordName(feature.name)} `))) return ''
  const biographyLabel = /^(?:Faith(?: or deity| details|\/guiding philosophy)?|Faith symbol|Home region or place of origin|Place of origin|Current residence(?: or base)?|Current residence\/base|Former residence|Size|Height|Weight)(?:\s*:\s*|\s+)/i
  return clean
    .split(/(?<=[.;])\s+(?=[A-Z][A-Za-z /-]{1,50}:)/i)
    .filter((clause) => !biographyLabel.test(clause.trim()))
    .join(' ')
    .trim()
}

/**
 * Converts a Build 4.11 intake into the Build 4.12 canonical record in memory.
 * The original source text remains separately stored for audit and repair.
 */
export function canonicalizeCharacterRecord(
  result: CharacterIntakeResult,
  profileInput: unknown = [],
): CharacterIntakeResult {
  const features = characterFeatureEntries(result, profileInput)
  const proficiencies = characterProficiencies(result)
  const biography = characterBiography(result)
  const { feats_and_features: _legacyFeatures, ...characterWithoutLegacyFeatures } = result.character
  return {
    ...result,
    character: {
      ...characterWithoutLegacyFeatures,
      features,
      proficiencies,
      biography,
    },
    additional_details: (result.additional_details ?? [])
      .map((entry) => retainedAdditionalDetail(entry, features))
      .filter(Boolean),
  }
}

export function featureDisplayText(feature: CharacterFeatureEntry) {
  return feature.detail ? `${feature.name} — ${feature.detail}` : feature.name
}

export function featureRulesText(feature: CharacterFeatureEntry) {
  return feature.detail ? `${feature.name}: ${feature.detail}` : feature.name
}
