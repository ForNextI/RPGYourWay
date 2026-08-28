import type { CharacterIntakeResult, StoryFactEntry } from '@/lib/aigm/types'
import { characterBiography, characterFeatureEntries, featureDisplayText } from './character-record'
import { cleanSpellDisplayEntries, cleanSubclass } from './character-display-rules'

export { cleanSpellDisplayEntries, cleanSubclass }

export function classSummary(result: CharacterIntakeResult) {
  return (result.character.classes ?? [])
    .map((entry) => {
      const subclass = cleanSubclass(entry.subclass)
      return `${entry.name} ${entry.level}${subclass ? ` · ${subclass}` : ''}`
    })
    .join(' / ') || 'Class not found'
}

export function divineOrder(result: CharacterIntakeResult) {
  for (const value of [...characterFeatureEntries(result).map(featureDisplayText), ...(result.additional_details ?? [])]) {
    const direct = value.match(/\bDivine Order\s*[-:—]\s*([^:.;]+)/i)
    if (direct?.[1]) return direct[1].trim()
    const reversed = value.match(/^\s*([^:(;]+?)\s*\(\s*Divine Order\s*\)/i)
    if (reversed?.[1]) return reversed[1].trim()
  }
  return ''
}

export function compactCharacterSummary(result: CharacterIntakeResult) {
  const classes = result.character.classes ?? []
  const subclasses = classes.map((entry) => cleanSubclass(entry.subclass)).filter(Boolean)
  const level = result.character.total_level || classes.reduce((sum, entry) => sum + (entry.level || 0), 0)
  return [
    level ? `Level ${level}` : '',
    ...subclasses,
    result.character.species,
    divineOrder(result),
  ].filter(Boolean).join(' · ')
}

const KNOWLEDGE_LABEL = /^(?:personality traits?|ideals?|bonds?|flaws?|allies?(?: and organizations?)?|character notes, goals, fears, and relationships|background summary|backstory|fear|appearance)\s*:\s*/i

function withoutKnowledgeLabels(value: string) {
  let clean = value.trim()
  let previous = ''
  while (clean && clean !== previous) {
    previous = clean
    clean = clean.replace(KNOWLEDGE_LABEL, '').trim()
  }
  return clean
}

function normalizedKnowledge(value: string) {
  return withoutKnowledgeLabels(
    value.replace(/\([^)]*\b(?:party known|public|probably private|unknown)\b[^)]*\)\s*$/i, ''),
  )
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function uniqueByKnowledge(values: string[], seen = new Set<string>()) {
  const output: string[] = []
  for (const raw of values) {
    const value = raw.trim()
    if (!value) continue
    const key = normalizedKnowledge(value)
    if (!key || seen.has(key)) continue
    seen.add(key)
    output.push(value)
  }
  return output
}

export function appearanceDetail(result: CharacterIntakeResult) {
  const canonical = characterBiography(result).appearance
  if (canonical) return canonical
  const sources = [
    ...(result.additional_details ?? []),
    ...(result.character.personality_goals_and_fears ?? []),
    ...(result.character.story_facts ?? []).map((entry) => entry.fact),
  ]
  const found = sources.find((value) => /(?:^|:\s*)Appearance\s*:/i.test(value))
  if (!found) return ''
  return found.replace(/^.*?Appearance\s*:\s*/i, '').trim()
}

function isAppearance(value: string) {
  return /(?:^|:\s*)Appearance\s*:/i.test(value)
}

export function visibleCharacterKnowledge(result: CharacterIntakeResult) {
  const seen = new Set<string>()
  const personality = uniqueByKnowledge(
    (result.character.personality_goals_and_fears ?? []).filter((value) => !isAppearance(value)),
    seen,
  )
  const relationships = uniqueByKnowledge(result.character.relationships_and_organizations ?? [], seen)
  const storyFacts: StoryFactEntry[] = []
  for (const entry of result.character.story_facts ?? []) {
    if (!entry.fact.trim() || isAppearance(entry.fact)) continue
    const key = normalizedKnowledge(entry.fact)
    if (!key || seen.has(key)) continue
    seen.add(key)
    storyFacts.push(entry)
  }
  const additionalDetails = uniqueByKnowledge(
    (result.additional_details ?? []).filter((value) => !isAppearance(value)),
    seen,
  )
  return { personality, relationships, storyFacts, additionalDetails }
}
