import 'server-only'
import fs from 'node:fs'
import path from 'node:path'
import { dnd55ClassFeatureNamesThroughLevel, dnd55ClassMetadata, dnd55SubclassFeatureNamesThroughLevel } from '@/lib/aigm/multiclassing'
import { canonicalizeCharacterRecord, characterFeatureEntries, normalizedRecordName } from '@/lib/aigm/character-record'
import type { CharacterFeatureEntry, CharacterIntakeResult } from '@/lib/aigm/types'

interface RulesChunk { title: string; text: string }
interface RulesCorpus { source: string; license: string; chunks: RulesChunk[] }

export interface SrdRecordDetail {
  name: string
  text: string
  source: string
  license: string
  kind: 'class_feature' | 'subclass_feature' | 'feat' | 'species_trait' | 'class_option' | 'spell'
}

export interface CharacterRuleEnrichment {
  result: CharacterIntakeResult
  added: string[]
  expanded: string[]
}

const DND55_CORPUS = 'dnd-5.5e-srd-5.2.1.json'
const SRD_ATTRIBUTION = 'Rules text includes material from the System Reference Document 5.2.1 (SRD 5.2.1) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd, licensed under the Creative Commons Attribution 4.0 International License at https://creativecommons.org/licenses/by/4.0/legalcode.'
const METAMAGIC_OPTIONS = ['Careful Spell','Distant Spell','Empowered Spell','Extended Spell','Heightened Spell','Quickened Spell','Seeking Spell','Subtle Spell','Transmuted Spell','Twinned Spell']
const INVOCATION_OPTIONS = ['Agonizing Blast','Armor of Shadows','Ascendant Step','Devil’s Sight','Devouring Blade','Eldritch Mind','Eldritch Smite','Eldritch Spear','Fiendish Vigor','Gaze of Two Minds','Gift of the Depths','Gift of the Protectors','Investment of the Chain Master','Lessons of the First Ones','Lifedrinker','Mask of Many Faces','Master of Myriad Forms','Misty Visions','One with Shadows','Otherworldly Leap','Pact of the Blade','Pact of the Chain','Pact of the Tome','Repelling Blast','Thirsting Blade','Visions of Distant Realms','Whispers of the Grave','Witch Sight']
const SPECIES_BASES = ['Dragonborn','Dwarf','Elf','Gnome','Goliath','Halfling','Human','Orc','Tiefling'] as const

let corpusCache: RulesCorpus | null = null
let joinedCache = ''
let featCatalogCache: Map<string, { name: string; text: string }> | null = null
let spellCatalogCache: Map<string, { name: string; text: string }> | null = null

function corpus() {
  if (corpusCache) return corpusCache
  corpusCache = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'rules', 'corpora', DND55_CORPUS), 'utf8')) as RulesCorpus
  return corpusCache
}

function joinedCorpusText() {
  if (!joinedCache) joinedCache = corpus().chunks.map((chunk) => chunk.text).join('\n')
  return joinedCache
}

function escaped(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
function flexibleWhitespacePattern(value: string) { return value.trim().split(/\s+/).map(escaped).join('\\s+') }
function normalizeName(value: string) {
  return value.normalize('NFKD').replace(/[’']/g, '').toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}
function stripPageFurniture(value: string) {
  return value
    .replace(/\u00ad/g, '')
    .replace(/(?:^|\n)System Reference Document 5\.2\.1\s*\n\s*\d+\s*(?=\n|$)/g, '\n')
    .replace(/-\n(?=[a-z])/g, '')
}
function readable(value: string) { return stripPageFurniture(value).replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim() }
function detail(name: string, text: string, kind: SrdRecordDetail['kind']): SrdRecordDetail | null {
  const clean = readable(text)
  if (!clean) return null
  return { name, text: clean.slice(0, 6000), source: corpus().source, license: corpus().license, kind }
}

function rawClassSection(className: string) {
  const text = joinedCorpusText()
  const cp = flexibleWhitespacePattern(className)
  const start = new RegExp(`(?:^|\\n)${cp}\\s*\\nCore ${cp} Traits\\b`, 'i').exec(text) || new RegExp(`(?:^|\\n)Core ${cp} Traits\\b`, 'i').exec(text)
  if (!start || start.index === undefined) return ''
  const rest = text.slice(start.index + start[0].length)
  const next = /(?:^|\n)(?:Barbarian|Bard|Cleric|Druid|Fighter|Monk|Paladin|Ranger|Rogue|Sorcerer|Warlock|Wizard)\s*\nCore [A-Za-z][A-Za-z -]+ Traits\b/im.exec(rest)
  return text.slice(start.index, next?.index === undefined ? text.length : start.index + start[0].length + next.index)
}

function levelHeadingDetail(section: string, featureName: string, kind: SrdRecordDetail['kind']) {
  const match = new RegExp(`(?:^|\\n)\\s*Level\\s+\\d+:\\s*${flexibleWhitespacePattern(featureName)}\\s*(?:\\n|$)`, 'i').exec(section)
  if (!match || match.index === undefined) return null
  const rest = section.slice(match.index + match[0].length)
  const stops = [
    /(?:^|\n)\s*Level\s+\d+:\s*/im.exec(rest)?.index,
    /(?:^|\n)\s*(?:Barbarian|Bard|Cleric|Druid|Fighter|Monk|Paladin|Ranger|Rogue|Sorcerer|Warlock|Wizard) Features\s*$/im.exec(rest)?.index,
    /(?:^|\n)\s*(?:Barbarian|Bard|Cleric|Druid|Fighter|Monk|Paladin|Ranger|Rogue|Sorcerer|Warlock|Wizard) Subclass:/im.exec(rest)?.index,
  ].filter((value): value is number => typeof value === 'number' && value >= 0)
  return detail(featureName, rest.slice(0, stops.length ? Math.min(...stops) : rest.length), kind)
}

export function dnd55ClassFeatureDetail(className: string, featureName: string) {
  if (!className.trim() || !featureName.trim() || /\bSubclass(?: feature)?$/i.test(featureName.trim())) return null
  return levelHeadingDetail(rawClassSection(className), featureName, 'class_feature')
}

function rawSubclassSection(className: string, subclassName: string) {
  const section = rawClassSection(className)
  const heading = new RegExp(`(?:^|\\n)${flexibleWhitespacePattern(className)}\\s+Subclass:\\s*${flexibleWhitespacePattern(subclassName)}\\s*(?:\\n|$)`, 'i').exec(section)
  return heading && heading.index !== undefined ? section.slice(heading.index + heading[0].length) : ''
}

export function dnd55SubclassFeatureDetail(className: string, subclassName: string, featureName: string) {
  if (!className.trim() || !subclassName.trim() || !featureName.trim()) return null
  return levelHeadingDetail(rawSubclassSection(className, subclassName), featureName, 'subclass_feature')
}

function featCatalog() {
  if (featCatalogCache) return featCatalogCache
  const text = joinedCorpusText()
  const regex = /(?:^|\n)([^\n]{2,90})\n((?:Origin|General|Fighting Style|Epic Boon) Feat)\n/gm
  const matches: Array<{ index: number; end: number; name: string; category: string }> = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(text))) {
    const name = match[1].replace(/\s+/g, ' ').trim()
    if (name && !/^(?:Parts of a Feat|Feat Descriptions)$/i.test(name)) matches.push({ index: match.index, end: regex.lastIndex, name, category: match[2] })
  }
  const equipment = text.search(/(?:^|\n)Equipment\s*$/m)
  const map = new Map<string, { name: string; text: string }>()
  matches.forEach((entry, index) => {
    const next = matches[index + 1]?.index ?? (equipment > entry.end ? equipment : text.length)
    map.set(normalizeName(entry.name), { name: entry.name, text: `${entry.category}. ${readable(text.slice(entry.end, next))}` })
  })
  featCatalogCache = map
  return map
}

function candidateFeatureNames(value: string) {
  const clean = value.replace(/^[\s•*\-]+/, '').trim()
  const first = clean.split(/\n/)[0]?.trim() || clean
  const candidates = [first.split(/\s+[—–-]\s+/)[0], first.split(/:\s+/)[0], first].filter(Boolean)
  return Array.from(new Set(candidates.flatMap((candidate) => [candidate, candidate.replace(/\s*\([^)]*\)\s*$/, '')]).map((candidate) => candidate.trim()).filter(Boolean)))
}

export function dnd55FeatDetail(featureEntryOrName: string) {
  const catalog = featCatalog()
  for (const candidate of candidateFeatureNames(featureEntryOrName)) {
    const found = catalog.get(normalizeName(candidate))
    if (found) return detail(found.name, found.text, 'feat')
  }
  return null
}

function speciesBase(species: string) {
  const normalized = normalizeName(species)
  return SPECIES_BASES.find((name) => normalized.includes(normalizeName(name))) || ''
}
function rawSpeciesSection(species: string) {
  const base = speciesBase(species)
  if (!base) return ''
  const text = joinedCorpusText()
  const start = new RegExp(`(?:^|\\n)${escaped(base)}\\s*\\nCreature Type:`, 'i').exec(text)
  if (!start || start.index === undefined) return ''
  const rest = text.slice(start.index + start[0].length)
  const next = new RegExp(`(?:^|\\n)(?:${SPECIES_BASES.filter((name) => name !== base).map(escaped).join('|')})\\s*\\nCreature Type:`, 'i').exec(rest)
  return rest.slice(0, next?.index === undefined ? rest.length : next.index)
}

export function dnd55SpeciesTraitDetail(species: string, featureEntryOrName: string) {
  const section = rawSpeciesSection(species)
  if (!section) return null
  for (const candidate of candidateFeatureNames(featureEntryOrName)) {
    const match = new RegExp(`(?:^|\\n)\\s*${escaped(candidate)}\\.\\s*`, 'i').exec(section)
    if (!match || match.index === undefined) continue
    const rest = section.slice(match.index + match[0].length)
    const next = /(?:^|\n)\s*[A-Z][A-Za-z’' -]{2,80}\.\s*/m.exec(rest)
    const found = detail(candidate, rest.slice(0, next?.index === undefined ? rest.length : next.index), 'species_trait')
    if (found) return found
  }
  return null
}

function namedOptionsSection(className: string, heading: string, stopHeading: string) {
  const section = rawClassSection(className)
  const start = new RegExp(`(?:^|\\n)${escaped(heading)}\\s*(?:\\n|$)`, 'i').exec(section)
  if (!start || start.index === undefined) return ''
  const rest = section.slice(start.index + start[0].length)
  const stop = new RegExp(`(?:^|\\n)${escaped(stopHeading)}\\s*(?:\\n|$)`, 'i').exec(rest)
  return rest.slice(0, stop?.index === undefined ? rest.length : stop.index)
}
function exactNamedOptionDetail(section: string, optionName: string, allNames: string[]) {
  const start = new RegExp(`(?:^|\\n)${escaped(optionName)}\\s*(?:\\n|$)`, 'i').exec(section)
  if (!start || start.index === undefined) return ''
  const rest = section.slice(start.index + start[0].length)
  const laterNames = allNames.filter((name) => normalizeName(name) !== normalizeName(optionName))
  const next = new RegExp(`(?:^|\\n)(?:${laterNames.map(escaped).join('|')})\\s*(?:\\n|$)`, 'i').exec(rest)
  return rest.slice(0, next?.index === undefined ? rest.length : next.index)
}

export function dnd55ClassOptionDetail(className: string, featureEntryOrName: string) {
  const normalizedClass = normalizeName(className)
  const names = normalizedClass === 'sorcerer' ? METAMAGIC_OPTIONS : normalizedClass === 'warlock' ? INVOCATION_OPTIONS : []
  const section = normalizedClass === 'sorcerer'
    ? namedOptionsSection('Sorcerer', 'Metamagic Options', 'Sorcerer Spell List')
    : normalizedClass === 'warlock'
      ? namedOptionsSection('Warlock', 'Eldritch Invocation Options', 'Warlock Spell List')
      : ''
  if (!section) return null
  for (const candidate of candidateFeatureNames(featureEntryOrName)) {
    const canonical = names.find((name) => normalizeName(name) === normalizeName(candidate))
    if (!canonical) continue
    const found = detail(canonical, exactNamedOptionDetail(section, canonical, names), 'class_option')
    if (found) return found
  }
  return null
}

function spellCatalog() {
  if (spellCatalogCache) return spellCatalogCache
  const text = joinedCorpusText()
  const regex = /(?:^|\n)([^\n]{2,90})\n((?:Level\s+\d+\s+[^\n(]+|[^\n(]+\s+Cantrip)\s+\([^)]{1,220}\))\nCasting Time:/gm
  const matches: Array<{ index: number; end: number; name: string; header: string }> = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(text))) {
    const name = match[1].replace(/\s+/g, ' ').trim()
    if (name) matches.push({ index: match.index, end: regex.lastIndex, name, header: match[2] })
  }
  const map = new Map<string, { name: string; text: string }>()
  matches.forEach((entry, index) => {
    const end = matches[index + 1]?.index ?? text.length
    map.set(normalizeName(entry.name), { name: entry.name, text: `${entry.header}\nCasting Time:${text.slice(entry.end, end)}` })
  })
  spellCatalogCache = map
  return map
}

export function dnd55SpellDetail(spellEntryOrName: string) {
  const catalog = spellCatalog()
  for (const candidate of candidateFeatureNames(spellEntryOrName)) {
    const found = catalog.get(normalizeName(candidate))
    if (found) return detail(found.name, found.text, 'spell')
  }
  return null
}

function alreadyHasRulesDetail(entry: CharacterFeatureEntry, detailValue: SrdRecordDetail) {
  const key = normalizeName(entry.detail)
  const sample = normalizeName(detailValue.text).split(' ').slice(0, 12).join(' ')
  return Boolean(sample && key.includes(sample)) || /\bSRD rules:\s*/i.test(entry.detail)
}
function mergedDetail(existing: CharacterFeatureEntry, detailValue: SrdRecordDetail) {
  if (alreadyHasRulesDetail(existing, detailValue)) return existing
  if (!existing.detail) return { ...existing, detail: detailValue.text, source: detailValue.source }
  // Keep character-specific selections or concise imported summaries, then add the canonical rule.
  // This avoids erasing details such as which skills received Expertise or which weapon masteries were selected.
  return { ...existing, detail: `${existing.detail.replace(/\s+$/, '')} SRD rules: ${detailValue.text}`, source: existing.source || detailValue.source }
}
function upsertDetail(
  features: CharacterFeatureEntry[],
  detailValue: SrdRecordDetail,
  added: string[],
  expanded: string[],
  ownership: Pick<CharacterFeatureEntry, 'category' | 'class_name' | 'subclass_name' | 'level_gained'>,
) {
  const index = features.findIndex((entry) => normalizedRecordName(entry.name) === normalizedRecordName(detailValue.name))
  if (index < 0) {
    features.push({
      id: '',
      name: detailValue.name,
      detail: detailValue.text,
      source: detailValue.source,
      ...ownership,
    })
    added.push(detailValue.name)
    return
  }
  const next = mergedDetail({ ...features[index], ...ownership }, detailValue)
  if (readable(features[index].detail) === readable(next.detail)) return
  features[index] = next
  expanded.push(detailValue.name)
}

export function enrichDnd55CharacterRecord(result: CharacterIntakeResult): CharacterRuleEnrichment {
  if (!/(?:5\.5e|2024)/i.test(result.intake_settings?.ruleset || '')) return { result, added: [], expanded: [] }
  const features = characterFeatureEntries(result).map((entry) => ({ ...entry }))
  const added: string[] = []
  const expanded: string[] = []

  for (const classEntry of result.character.classes ?? []) {
    if (!dnd55ClassMetadata(classEntry.name)) continue
    for (const name of dnd55ClassFeatureNamesThroughLevel(classEntry.name, classEntry.level)) {
      const found = dnd55ClassFeatureDetail(classEntry.name, name)
      if (found) upsertDetail(features, found, added, expanded, {
        category: 'class', class_name: classEntry.name, subclass_name: '', level_gained: 0,
      })
    }
    if (classEntry.subclass) {
      for (const name of dnd55SubclassFeatureNamesThroughLevel(classEntry.name, classEntry.subclass, classEntry.level)) {
        const found = dnd55SubclassFeatureDetail(classEntry.name, classEntry.subclass, name)
        if (found) upsertDetail(features, found, added, expanded, {
          category: 'subclass', class_name: classEntry.name, subclass_name: classEntry.subclass, level_gained: 0,
        })
      }
    }
  }

  // Selected feats, species traits, Metamagic choices, and Invocations are character-specific.
  // Expand only entries already present so RPG Your Way never invents a choice the player did not make.
  for (let index = 0; index < features.length; index += 1) {
    const entry = features[index]
    const found = dnd55FeatDetail(entry.name)
      || dnd55SpeciesTraitDetail(result.character.species, entry.name)
      || result.character.classes.map((classEntry) => dnd55ClassOptionDetail(classEntry.name, entry.name)).find(Boolean)
    if (!found) continue
    const category = found.kind === 'feat' ? 'feat' : found.kind === 'species_trait' ? 'species' : entry.category
    const next = mergedDetail({ ...entry, category }, found)
    if (readable(entry.detail) === readable(next.detail) && entry.category === next.category) continue
    features[index] = next
    if (!expanded.some((name) => normalizeName(name) === normalizeName(found.name))) expanded.push(found.name)
  }

  const changed = added.length > 0 || expanded.length > 0
  const additional = [...(result.additional_details ?? [])]
  if (changed && !additional.some((entry) => /System Reference Document 5\.2\.1.*Creative Commons Attribution 4\.0/i.test(entry))) {
    additional.push(SRD_ATTRIBUTION)
  }
  return {
    result: canonicalizeCharacterRecord({ ...result, character: { ...result.character, features }, additional_details: additional }),
    added,
    expanded,
  }
}
