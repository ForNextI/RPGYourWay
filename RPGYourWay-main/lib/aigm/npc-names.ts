import { randomInt } from 'node:crypto'
import nameDeck from '@/data/names/wardenspc-npc-name-deck-3.8.2.json'

interface NpcNameDeck {
  schemaVersion: number
  deckVersion: string
  givenNames: string[]
  surnames: string[]
  globalBlockedNames: string[]
}

export interface NpcNameHand {
  deck_version: string
  given_names: string[]
  surnames: string[]
}

const deck = nameDeck as NpcNameDeck
const blocked = new Set(deck.globalBlockedNames.map(normalizeName))

function normalizeName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^\p{L}]/gu, '')
    .toLocaleLowerCase('en-US')
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
  if (shorter >= 4 && left.slice(0, 4) === right.slice(0, 4)) return true
  if (shorter >= 5 && left.slice(-4) === right.slice(-4)) return true

  const distance = editDistance(left, right)
  if (distance <= 1) return true
  return shorter >= 7 && distance <= 2
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

function establishedTokens(values: string[]) {
  return values.flatMap((value) => value.split(/[^\p{L}'’-]+/u)).map((value) => value.trim()).filter((value) => normalizeName(value).length >= 3)
}

function chooseNames(source: string[], count: number, established: string[]) {
  const selected: string[] = []
  const disallowed = [...established, ...deck.globalBlockedNames]

  for (const candidate of shuffled(source)) {
    const normalized = normalizeName(candidate)
    if (!normalized || blocked.has(normalized)) continue
    if (disallowed.some((name) => tooSimilar(candidate, name))) continue
    if (selected.some((name) => tooSimilar(candidate, name))) continue
    selected.push(candidate)
    if (selected.length >= count) return selected
  }

  // The deck is deliberately broad, but retain a graceful fallback if an
  // unusually crowded campaign filters the first pass too aggressively.
  for (const candidate of shuffled(source)) {
    const normalized = normalizeName(candidate)
    if (!normalized || blocked.has(normalized) || selected.includes(candidate)) continue
    if (established.some((name) => normalizeName(name) === normalized)) continue
    selected.push(candidate)
    if (selected.length >= count) break
  }

  return selected
}

export function npcNameHand(establishedNames: string[], givenCount = 12, surnameCount = 8): NpcNameHand {
  const established = establishedTokens(establishedNames)
  const givenNames = chooseNames(deck.givenNames, givenCount, established)
  const surnames = chooseNames(deck.surnames, surnameCount, [...established, ...givenNames])

  return {
    deck_version: deck.deckVersion,
    given_names: givenNames,
    surnames,
  }
}
