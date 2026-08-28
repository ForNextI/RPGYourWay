export type DmMysteryCommitmentStatus = 'active' | 'resolved' | 'retired'

export interface DmMysteryCommitment {
  id: string
  question: string
  hidden_truth: string
  status: DmMysteryCommitmentStatus
}

function mysteryQuestionKey(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Preserve the committed answer to a substantial private mystery. Ordinary turns
 * may resolve or retire an existing commitment, but cannot rewrite its hidden truth.
 * Replacing an answer requires explicitly retiring the old commitment and creating
 * a new id, which leaves the old decision visible in private campaign state.
 */
export function mergeMysteryCommitments(
  prior: DmMysteryCommitment[],
  returned: DmMysteryCommitment[],
): DmMysteryCommitment[] {
  const returnedById = new Map(returned.map((entry) => [entry.id, entry]))
  const result: DmMysteryCommitment[] = []
  const knownIds = new Set<string>()

  for (const existing of prior) {
    const match = returnedById.get(existing.id)
    const terminal = existing.status === 'resolved' || existing.status === 'retired'
    result.push({
      ...existing,
      hidden_truth: existing.hidden_truth,
      status: terminal ? existing.status : (match?.status ?? existing.status),
    })
    knownIds.add(existing.id)
  }

  for (const entry of returned) {
    if (knownIds.has(entry.id)) continue

    const questionKey = mysteryQuestionKey(entry.question)
    const sameQuestion = prior.filter((existing) => mysteryQuestionKey(existing.question) === questionKey)
    if (sameQuestion.some((existing) => existing.status === 'resolved')) continue

    const activeSameQuestion = sameQuestion.find((existing) => existing.status === 'active')
    if (activeSameQuestion) {
      const requestedExisting = returnedById.get(activeSameQuestion.id)
      if (requestedExisting?.status !== 'retired') continue
    }

    if (result.some((existing) => existing.status === 'active' && mysteryQuestionKey(existing.question) === questionKey)) continue

    result.push(entry)
    knownIds.add(entry.id)
    if (result.length >= 10) break
  }

  return [...result.filter((entry) => entry.status === 'active'), ...result.filter((entry) => entry.status !== 'active')].slice(0, 10)
}
