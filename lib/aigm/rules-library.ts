import fs from 'node:fs'
import path from 'node:path'
import type { BuiltInRulesetId, SupportedSystemMatch } from '@/lib/aigm/supported-systems'

interface RulesChunk {
  id: string
  title: string
  text: string
}

interface RulesCorpus {
  id: BuiltInRulesetId
  label: string
  source: string
  license: string
  chunks: RulesChunk[]
}

interface PreparedCorpus {
  corpus: RulesCorpus
  postings: Map<string, Map<number, number>>
}

export interface RulesReferenceResult {
  system: SupportedSystemMatch
  source: string
  license: string
  excerpts: Array<{ title: string; text: string }>
}

export interface BuiltInSubclassInfo {
  name: string
  reference: RulesReferenceResult
}

const DND_55_SRD_SUBCLASSES: Record<string, string> = {
  barbarian: 'Path of the Berserker',
  bard: 'College of Lore',
  cleric: 'Life Domain',
  druid: 'Circle of the Land',
  fighter: 'Champion',
  monk: 'Warrior of the Open Hand',
  paladin: 'Oath of Devotion',
  ranger: 'Hunter',
  rogue: 'Thief',
  sorcerer: 'Draconic Sorcery',
  warlock: 'Fiend Patron',
  wizard: 'Evoker',
}

const cache = new Map<BuiltInRulesetId, PreparedCorpus>()
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'because', 'been', 'but', 'by', 'can', 'could', 'did', 'do', 'does', 'for', 'from',
  'game', 'had', 'has', 'have', 'he', 'her', 'here', 'him', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'me', 'my',
  'of', 'on', 'or', 'our', 'player', 'roll', 'rules', 'should', 'so', 'that', 'the', 'their', 'them', 'then', 'there', 'they', 'this',
  'to', 'use', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'who', 'will', 'with', 'would', 'you', 'your',
])

function normalizedTerms(value: string, maximum = Number.POSITIVE_INFINITY) {
  const terms = value
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9+.-]+/g, ' ')
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3 && !STOPWORDS.has(term))
  return Array.from(new Set(terms)).slice(0, maximum)
}

function addPosting(postings: Map<string, Map<number, number>>, term: string, chunkIndex: number, weight: number) {
  const byChunk = postings.get(term) || new Map<number, number>()
  byChunk.set(chunkIndex, Math.min((byChunk.get(chunkIndex) || 0) + weight, 14))
  postings.set(term, byChunk)
}

function prepareCorpus(corpus: RulesCorpus): PreparedCorpus {
  const postings = new Map<string, Map<number, number>>()
  corpus.chunks.forEach((chunk, chunkIndex) => {
    const titleTerms = normalizedTerms(chunk.title)
    for (const term of titleTerms) addPosting(postings, term, chunkIndex, 9)

    const counts = new Map<string, number>()
    for (const term of chunk.text
      .toLocaleLowerCase('en-US')
      .replace(/[^a-z0-9+.-]+/g, ' ')
      .split(/\s+/)) {
      if (term.length < 3 || STOPWORDS.has(term)) continue
      counts.set(term, Math.min((counts.get(term) || 0) + 1, 5))
    }
    for (const [term, count] of counts) addPosting(postings, term, chunkIndex, count)
  })
  return { corpus, postings }
}

function corpusFor(id: BuiltInRulesetId): PreparedCorpus {
  const existing = cache.get(id)
  if (existing) return existing
  const filename = path.join(process.cwd(), 'data', 'rules', 'corpora', `${id}.json`)
  const parsed = JSON.parse(fs.readFileSync(filename, 'utf8')) as RulesCorpus
  const prepared = prepareCorpus(parsed)
  cache.set(id, prepared)
  return prepared
}

function normalizedPhrase(value: string) {
  return value
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9+.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function phraseCount(value: string, phrase: string) {
  if (!phrase) return 0
  let count = 0
  let offset = 0
  while (offset < value.length) {
    const found = value.indexOf(phrase, offset)
    if (found < 0) break
    const before = found === 0 ? ' ' : value[found - 1]
    const afterIndex = found + phrase.length
    const after = afterIndex >= value.length ? ' ' : value[afterIndex]
    if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) count += 1
    offset = found + Math.max(phrase.length, 1)
  }
  return count
}

export function rulesReferenceForClassAdvancement(
  system: SupportedSystemMatch,
  className: string,
  targetLevel: number,
  maximumCharacters = 11_000,
): RulesReferenceResult | null {
  if (!system.builtIn || system.id === 'other-best-effort') return null
  const { corpus } = corpusFor(system.id)
  const classPhrase = normalizedPhrase(className)
  if (!classPhrase) return null

  const normalizedChunks = corpus.chunks.map((chunk) => normalizedPhrase(`${chunk.title}\n${chunk.text}`))
  const coreNeedles = [
    `core ${classPhrase} traits`,
    `${classPhrase} class features`,
    `${classPhrase} features`,
  ]
  const anchorIndex = normalizedChunks.findIndex((text) => coreNeedles.some((needle) => text.includes(needle)))

  const candidateScores = new Map<number, number>()
  const addCandidate = (index: number, score: number) => {
    if (index < 0 || index >= corpus.chunks.length) return
    candidateScores.set(index, Math.max(candidateScores.get(index) || 0, score))
  }

  // When the corpus has a recognizable class heading, keep the retrieval window
  // physically centered on that class. This prevents generic terms such as
  // "spell slots" from crowding a martial class table out of a five-chunk result.
  if (anchorIndex >= 0) {
    addCandidate(anchorIndex, 1_000)
    for (let distance = 1; distance <= 4; distance += 1) {
      const index = anchorIndex + distance
      if (index >= corpus.chunks.length) break
      const text = normalizedChunks[index]
      const raw = corpus.chunks[index].text
      const startsAnotherClass = /\bcore\s+[a-z][a-z -]+\s+traits\b/.test(text)
        && !text.includes(`core ${classPhrase} traits`)
      if (startsAnotherClass) break

      let score = 600 - distance * 70
      if (text.includes(`level ${targetLevel}:`)) score += 500
      if (text.includes(`level ${targetLevel} `)) score += 180
      if (new RegExp(`(?:^|\\n)\\s*${targetLevel}\\s+\\+?\\d`, 'm').test(raw)) score += 300
      if (phraseCount(text, classPhrase) > 0) score += 120
      addCandidate(index, score)
    }
  }

  // Fallback for built-in corpora whose class sections use different headings.
  // Class-name relevance stays dominant; target-level language refines the order.
  normalizedChunks.forEach((text, index) => {
    const occurrences = phraseCount(text, classPhrase)
    if (occurrences === 0) return
    let score = Math.min(occurrences, 12) * 45
    if (text.includes(`level ${targetLevel}:`)) score += 260
    if (text.includes(`level ${targetLevel} `)) score += 120
    if (text.includes(`${classPhrase} class`)) score += 180
    if (text.includes(`${classPhrase} features`)) score += 160
    addCandidate(index, score)
  })

  const rankedIndexes = [...candidateScores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([index]) => index)

  const excerpts: Array<{ title: string; text: string }> = []
  let used = 0
  for (const index of rankedIndexes) {
    if (excerpts.length >= 5) break
    const chunk = corpus.chunks[index]
    const remaining = maximumCharacters - used
    if (!chunk || remaining < 600) break
    const text = chunk.text.slice(0, remaining)
    excerpts.push({ title: chunk.title, text })
    used += text.length
  }

  return { system, source: corpus.source, license: corpus.license, excerpts }
}

function escapedRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function classLevelUsesSubclass(system: SupportedSystemMatch, className: string, targetLevel: number) {
  if (!system.builtIn || system.id !== 'dnd-5.5e-srd-5.2.1') return false
  const { corpus } = corpusFor(system.id)
  const section = classSectionText(corpus, className)
  if (!section) return false
  const classPattern = className.trim().split(/\s+/).map(escapedRegExp).join('\\s+')
  const levelPattern = escapedRegExp(String(targetLevel))
  const heading = new RegExp(`Level\\s+${levelPattern}:\\s+${classPattern}\\s+Subclass\\b`, 'i')
  const tableRow = new RegExp(`(?:^|\\n)\\s*${levelPattern}\\s+\\+?\\d+[^\\n]{0,180}\\bSubclass(?:\\s+feature)?\\b`, 'im')
  return heading.test(section) || tableRow.test(section)
}

export function builtInSubclassForClass(system: SupportedSystemMatch, className: string, maximumCharacters = 8_000): BuiltInSubclassInfo | null {
  if (!system.builtIn || system.id !== 'dnd-5.5e-srd-5.2.1') return null
  const name = DND_55_SRD_SUBCLASSES[className.trim().toLocaleLowerCase('en-US')]
  if (!name) return null
  const { corpus } = corpusFor(system.id)
  const classPattern = className.trim().split(/\s+/).map(escapedRegExp).join('\\s+')
  const subclassPattern = name.split(/\s+/).map(escapedRegExp).join('\\s+')
  const heading = new RegExp(`${classPattern}\\s+Subclass:\\s*${subclassPattern}`, 'i')
  const candidates = corpus.chunks.flatMap((chunk, index) => {
    const match = heading.exec(chunk.text)
    if (!match || match.index === undefined) return []
    const afterHeading = chunk.text.slice(match.index)
    const levelHeadings = (afterHeading.match(/(?:^|\n)\s*Level\s+\d+:/gim) ?? []).length
    return [{ index, matchIndex: match.index, levelHeadings }]
  })
  if (candidates.length === 0) return null
  // The SRD contents page also names every subclass. Prefer the occurrence that
  // actually contains level headings, then the later occurrence on a tie.
  candidates.sort((left, right) => right.levelHeadings - left.levelHeadings || right.index - left.index)
  const chosen = candidates[0]
  let used = 0
  const excerpts: Array<{ title: string; text: string }> = []
  for (let offset = 0; offset < 3; offset += 1) {
    const candidate = corpus.chunks[chosen.index + offset]
    if (!candidate) break
    let text = offset === 0 ? candidate.text.slice(chosen.matchIndex) : candidate.text
    const nextClass = text.search(/(?:^|\n)\s*Core\s+[A-Za-z][A-Za-z -]+\s+Traits\b/im)
    if (nextClass >= 0) text = text.slice(0, nextClass)
    const remaining = maximumCharacters - used
    if (remaining < 400) break
    text = text.slice(0, remaining)
    if (text.trim()) excerpts.push({ title: `${className} Subclass: ${name}`, text })
    used += text.length
    if (used >= maximumCharacters || nextClass >= 0) break
  }
  if (excerpts.length === 0) return null
  return { name, reference: { system, source: corpus.source, license: corpus.license, excerpts } }
}

export function builtInSubclassFeatureNamesAtLevel(system: SupportedSystemMatch, className: string, targetLevel: number) {
  const subclass = builtInSubclassForClass(system, className)
  if (!subclass) return []
  const text = subclass.reference.excerpts.map((excerpt) => excerpt.text).join('\n')
  const levelPattern = escapedRegExp(String(targetLevel))
  const heading = new RegExp(`(?:^|\\n)\\s*Level\\s+${levelPattern}:\\s*([^\\n]{1,160})`, 'gim')
  const names: string[] = []
  let match: RegExpExecArray | null
  while ((match = heading.exec(text))) {
    const name = match[1].replace(/\s+/g, ' ').trim()
    if (name && !names.some((entry) => entry.toLocaleLowerCase('en-US') === name.toLocaleLowerCase('en-US'))) names.push(name)
  }
  return names
}

export function rulesReferenceFor(system: SupportedSystemMatch, query: string, maximumCharacters = 11_000): RulesReferenceResult | null {
  if (!system.builtIn || system.id === 'other-best-effort') return null
  const { corpus, postings } = corpusFor(system.id)
  const scores = new Map<number, number>()
  for (const term of normalizedTerms(query, 36)) {
    const matches = postings.get(term)
    if (!matches) continue
    const rarity = 1 + Math.log((corpus.chunks.length + 1) / (matches.size + 1))
    for (const [chunkIndex, weight] of matches) {
      scores.set(chunkIndex, (scores.get(chunkIndex) || 0) + weight * rarity)
    }
  }

  const rankedIndexes = scores.size
    ? [...scores.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([index]) => index)
    : corpus.chunks.slice(0, 3).map((_, index) => index)

  const excerpts: Array<{ title: string; text: string }> = []
  let used = 0
  for (const index of rankedIndexes) {
    if (excerpts.length >= 5) break
    const chunk = corpus.chunks[index]
    const remaining = maximumCharacters - used
    if (!chunk || remaining < 600) break
    const text = chunk.text.slice(0, remaining)
    excerpts.push({ title: chunk.title, text })
    used += text.length
  }

  return { system, source: corpus.source, license: corpus.license, excerpts }
}

export function formatRulesReference(reference: RulesReferenceResult | null) {
  if (!reference || reference.excerpts.length === 0) return ''
  return [
    `BUILT-IN RULES REFERENCE: ${reference.system.label}`,
    `Source: ${reference.source}`,
    ...reference.excerpts.map((excerpt, index) => `\n[${index + 1}] ${excerpt.title}\n${excerpt.text}`),
  ].join('\n')
}

export interface SrdSpellOption {
  name: string
  level: number
}

export interface LevelUpSpellGuidance {
  levelOnePlusChange: 'none' | 'one' | 'any'
  cantripReplacement: boolean
  cantripListClass: string
  replacementSource: 'class_list' | 'spellbook'
  listLabel: 'prepared' | 'known' | 'prepared or known'
}

function classSectionText(corpus: RulesCorpus, className: string) {
  const classPhrase = normalizedPhrase(className)
  if (!classPhrase) return ''
  const normalizedChunks = corpus.chunks.map((chunk) => normalizedPhrase(`${chunk.title}\n${chunk.text}`))
  const anchorIndex = normalizedChunks.findIndex((text) => text.includes(`core ${classPhrase} traits`) || text.includes(`${classPhrase} class features`))
  if (anchorIndex < 0) return ''
  const sections: string[] = []
  for (let index = anchorIndex; index < Math.min(corpus.chunks.length, anchorIndex + 8); index += 1) {
    const text = normalizedChunks[index]
    if (index > anchorIndex && /\bcore\s+[a-z][a-z -]+\s+traits\b/.test(text) && !text.includes(`core ${classPhrase} traits`)) break
    sections.push(corpus.chunks[index].text)
  }
  return sections.join('\n')
}

function readableRulesText(value: string) {
  return value
    .replace(/-\n(?=[a-z])/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function hitPointDieForClass(system: SupportedSystemMatch, className: string) {
  if (!system.builtIn || system.id === 'other-best-effort') return 0
  const { corpus } = corpusFor(system.id)
  const section = classSectionText(corpus, className)
  const direct = section.match(/Hit Point Die\s+D(\d+)\s+per\s+[^\n]+\s+level/i)
  if (direct) return Number(direct[1]) || 0
  const legacy = section.match(/Hit Dice?\s*:?\s*1d(\d+)\s+per\s+[^\n]+\s+level/i)
  return legacy ? Number(legacy[1]) || 0 : 0
}

export function srdSpellCatalogForClass(system: SupportedSystemMatch, className: string): SrdSpellOption[] {
  if (!system.builtIn || system.id === 'other-best-effort') return []
  const { corpus } = corpusFor(system.id)
  const wantedClass = className.trim().toLocaleLowerCase('en-US')
  if (!wantedClass) return []
  const text = corpus.chunks.map((chunk) => chunk.text).join('\n')
  const spellPattern = /(?:^|\n)([^\n]{2,80})\n((?:Level\s+(\d+)\s+[^\n(]+|[^\n(]+\s+Cantrip))\s+\(([^)]{1,180})\)\nCasting Time:/gm
  const spells = new Map<string, SrdSpellOption>()
  let match: RegExpExecArray | null
  while ((match = spellPattern.exec(text))) {
    const name = match[1].replace(/\s+/g, ' ').trim()
    const level = match[3] ? Number(match[3]) : 0
    const classes = readableRulesText(match[4]).split(',').map((entry) => entry.trim().toLocaleLowerCase('en-US'))
    if (!name || !Number.isFinite(level) || !classes.includes(wantedClass)) continue
    spells.set(name.toLocaleLowerCase('en-US'), { name, level })
  }
  return [...spells.values()].sort((left, right) => left.level - right.level || left.name.localeCompare(right.name))
}

export function levelUpSpellGuidanceForClass(system: SupportedSystemMatch, className: string): LevelUpSpellGuidance {
  const fallback: LevelUpSpellGuidance = {
    levelOnePlusChange: 'none',
    cantripReplacement: false,
    cantripListClass: className.trim(),
    replacementSource: className.trim().toLocaleLowerCase('en-US') === 'wizard' ? 'spellbook' : 'class_list',
    listLabel: 'prepared or known',
  }
  if (!system.builtIn || system.id === 'other-best-effort') return fallback
  const { corpus } = corpusFor(system.id)
  const section = readableRulesText(classSectionText(corpus, className))
  if (!section) return fallback

  let levelOnePlusChange: LevelUpSpellGuidance['levelOnePlusChange'] = 'none'
  let listLabel: LevelUpSpellGuidance['listLabel'] = /Spells Known of Level 1\+|Spells Known of 1st Level/i.test(section) ? 'known' : 'prepared'
  const changePrepared = section.match(/Changing Your Prepared Spells\.[\s\S]{0,480}?(?=Spellcasting Ability|Spellcasting Focus|Level \d+:|$)/i)?.[0] || ''
  if (/replace any|change your list/i.test(changePrepared)) levelOnePlusChange = 'any'
  else if (/replace one spell/i.test(changePrepared)) levelOnePlusChange = 'one'
  else if (/replace one[^.]{0,180}spell/i.test(section)) levelOnePlusChange = 'one'

  if (listLabel === 'known' && levelOnePlusChange === 'none' && /gain a level[^.]{0,260}replace[^.]{0,260}spell/i.test(section)) {
    levelOnePlusChange = 'one'
  }

  const classPattern = className.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const cantripReplacementText = section.match(new RegExp(`Whenever you gain a ${classPattern} level[^.]{0,360}replace one[^.]{0,220}cantrip[^.]*`, 'i'))?.[0]
    || section.match(/gain a level[^.]{0,360}replace one[^.]{0,220}cantrip[^.]*/i)?.[0]
    || ''
  const cantripReplacement = Boolean(cantripReplacementText)
  const explicitCantripClass = cantripReplacementText.match(/(?:from the|another)\s+([A-Za-z]+)\s+(?:spell list|cantrip)/i)?.[1] || ''

  return {
    levelOnePlusChange,
    cantripReplacement,
    cantripListClass: explicitCantripClass || className.trim(),
    replacementSource: className.trim().toLocaleLowerCase('en-US') === 'wizard' ? 'spellbook' : 'class_list',
    listLabel,
  }
}
