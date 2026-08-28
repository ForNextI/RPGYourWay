import { randomInt } from 'node:crypto'
import placeDeck from '@/data/names/wardenspc-place-name-deck-3.8.5.json'

interface EstablishmentDeck {
  openers: string[]
  closers: string[]
  fixedNames: string[]
}

interface PlaceNameDeck {
  schemaVersion: number
  deckVersion: string
  settlements: { names: string[] }
  inns: EstablishmentDeck
  taverns: EstablishmentDeck
  globalBlockedFullNames: string[]
}

export interface PlaceNameHand {
  deck_version: string
  settlement_names: string[]
  inn_names: string[]
  tavern_names: string[]
}

const deck = placeDeck as PlaceNameDeck
const blocked = new Set(deck.globalBlockedFullNames.map(normalizeName))
const LIGHT_TOKENS = new Set(['the', 'and', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'over', 'under'])

function normalizeName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/^\s*the\s+/iu, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .toLocaleLowerCase('en-US')
}

function meaningfulTokens(value: string) {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase('en-US')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 3 && !LIGHT_TOKENS.has(token))
}

function editDistance(left: string, right: string) {
  if (left === right) return 0
  if (!left) return right.length
  if (!right) return left.length

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  const current = new Array<number>(right.length + 1)

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      )
    }
    for (let index = 0; index < current.length; index += 1) previous[index] = current[index]
  }

  return previous[right.length]
}

function tooSimilar(leftValue: string, rightValue: string) {
  const left = normalizeName(leftValue)
  const right = normalizeName(rightValue)
  if (!left || !right) return false
  if (left === right) return true

  const shorter = Math.min(left.length, right.length)
  if (shorter >= 6 && (left.startsWith(right) || right.startsWith(left))) return true

  const distance = editDistance(left, right)
  if (distance <= 1) return true
  return shorter >= 9 && distance <= 2
}

function shuffled<T>(values: readonly T[]) {
  const copy = [...values]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1)
    const value = copy[index]
    copy[index] = copy[swapIndex]
    copy[swapIndex] = value
  }
  return copy
}

function allowed(candidate: string, established: string[], selected: string[]) {
  const normalized = normalizeName(candidate)
  if (!normalized || blocked.has(normalized)) return false
  if (established.some((name) => tooSimilar(candidate, name))) return false
  if (selected.some((name) => tooSimilar(candidate, name))) return false
  return true
}

function chooseSettlements(established: string[], count: number) {
  const selected: string[] = []
  for (const candidate of shuffled(deck.settlements.names)) {
    if (!allowed(candidate, established, selected)) continue
    selected.push(candidate)
    if (selected.length >= count) break
  }
  return selected
}

function hasConspicuousTokenOverlap(candidate: string, selected: string[]) {
  const candidateTokens = new Set(meaningfulTokens(candidate))
  return selected.some((name) => meaningfulTokens(name).some((token) => candidateTokens.has(token)))
}

function generatedEstablishmentNames(source: EstablishmentDeck, established: string[], count: number) {
  const selected: string[] = []
  const usedOpeners = new Set<string>()
  const usedClosers = new Set<string>()

  for (const opener of shuffled(source.openers)) {
    if (usedOpeners.has(opener)) continue
    for (const closer of shuffled(source.closers)) {
      if (usedClosers.has(closer)) continue
      const candidate = `The ${opener} ${closer}`
      if (!allowed(candidate, established, selected)) continue
      if (hasConspicuousTokenOverlap(candidate, selected)) continue
      selected.push(candidate)
      usedOpeners.add(opener)
      usedClosers.add(closer)
      break
    }
    if (selected.length >= count) break
  }

  return selected
}

function fixedEstablishmentName(source: EstablishmentDeck, established: string[], selected: string[]) {
  for (const candidate of shuffled(source.fixedNames)) {
    if (!allowed(candidate, established, selected)) continue
    if (hasConspicuousTokenOverlap(candidate, selected)) continue
    return candidate
  }
  for (const candidate of shuffled(source.fixedNames)) {
    if (allowed(candidate, established, selected)) return candidate
  }
  return ''
}

function establishmentHand(source: EstablishmentDeck, established: string[]) {
  const generated = generatedEstablishmentNames(source, established, 4)
  const fixed = fixedEstablishmentName(source, established, generated)
  const complete = fixed ? [...generated, fixed] : generated

  // The active banks are large enough that this should remain exactly five,
  // but retain a safe fallback if an unusually crowded campaign filters hard.
  if (complete.length < 5) {
    for (const candidate of generatedEstablishmentNames(source, established, 12)) {
      if (complete.includes(candidate)) continue
      complete.push(candidate)
      if (complete.length >= 5) break
    }
  }

  return shuffled(complete).slice(0, 5)
}

export function placeNameHand(establishedNames: string[]): PlaceNameHand {
  const established = establishedNames.map((name) => name.trim()).filter(Boolean)
  return {
    deck_version: deck.deckVersion,
    settlement_names: chooseSettlements(established, 5),
    inn_names: establishmentHand(deck.inns, established),
    tavern_names: establishmentHand(deck.taverns, established),
  }
}
