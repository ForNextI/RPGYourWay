export type BuiltInRulesetId =
  | 'dnd-5.5e-srd-5.2.1'
  | 'dnd-5e-srd-5.1'
  | 'dnd-3.5e-srd'
  | 'pathfinder-2e-remaster'
  | 'pathfinder-1e'

export type RulesetId = BuiltInRulesetId | 'other-best-effort'

export interface SupportedSystemMatch {
  id: RulesetId
  label: string
  builtIn: boolean
  requestedLabel?: string
}

export const BUILT_IN_RULESETS: ReadonlyArray<{
  id: BuiltInRulesetId
  label: string
  shortLabel: string
}> = [
  { id: 'dnd-5.5e-srd-5.2.1', label: 'D&D 5.5e (2024 rules)', shortLabel: 'D&D 5.5e' },
  { id: 'dnd-5e-srd-5.1', label: 'D&D 5e (2014 rules)', shortLabel: 'D&D 5e' },
  { id: 'dnd-3.5e-srd', label: 'D&D 3.5e', shortLabel: 'D&D 3.5e' },
  { id: 'pathfinder-2e-remaster', label: 'Pathfinder 2e Remaster', shortLabel: 'Pathfinder 2e' },
  { id: 'pathfinder-1e', label: 'Pathfinder 1e', shortLabel: 'Pathfinder 1e' },
] as const

export const DEFAULT_RULESET_ID: BuiltInRulesetId = 'dnd-5.5e-srd-5.2.1'
export const DEFAULT_RULESET_LABEL = BUILT_IN_RULESETS[0].label

function normalized(value: string) {
  return value
    .toLocaleLowerCase('en-US')
    .replace(/[’']/g, '')
    .replace(/\bdungeons?\s*(?:&|and)\s*dragons?\b/g, 'dnd')
    .replace(/[^a-z0-9&+.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function builtIn(id: BuiltInRulesetId): SupportedSystemMatch {
  const system = BUILT_IN_RULESETS.find((entry) => entry.id === id)!
  return { id, label: system.label, builtIn: true }
}

export function supportedSystemFor(value: string): SupportedSystemMatch {
  const requested = value.trim()
  const name = normalized(requested)
  if (!name) return builtIn(DEFAULT_RULESET_ID)

  if (/\bpathfinder\b|\bpf\s*[12]e?\b/.test(name)) {
    if (/\b(?:1|1e|first)\b/.test(name) || /\bpf\s*1e?\b/.test(name)) return builtIn('pathfinder-1e')
    if (/\b(?:2|2e|second|remaster)\b/.test(name) || /\bpf\s*2e?\b/.test(name)) return builtIn('pathfinder-2e-remaster')
    return {
      id: 'other-best-effort',
      label: 'Other system (best-effort)',
      builtIn: false,
      requestedLabel: requested || 'Pathfinder',
    }
  }

  const asksForDnd = /\bdnd\b|\bd\s*&\s*d\b|\bsrd\b|\b5(?:\s*\.\s*5)?e\b|\b3\s*\.\s*5e?\b/.test(name)
  if (asksForDnd) {
    if (/\b3\s*\.\s*5e?\b|\b3\s*5e\b/.test(name)) return builtIn('dnd-3.5e-srd')
    if (/\b2014\b|\bsrd\s*5\s*1\b|\b5e\b/.test(name) && !/\b5\s*\.\s*5e\b|\b2024\b|\bsrd\s*5\s*2/.test(name)) return builtIn('dnd-5e-srd-5.1')
    if (/\b2024\b|\b5\s*\.\s*5e\b|\b5\s*5e\b|\bsrd\s*5\s*2/.test(name)) return builtIn('dnd-5.5e-srd-5.2.1')
    return builtIn(DEFAULT_RULESET_ID)
  }

  return {
    id: 'other-best-effort',
    label: 'Other system (best-effort)',
    builtIn: false,
    requestedLabel: requested || 'Other system',
  }
}

export function rulesetFromSetupAnswer(value: string) {
  return value.match(/^Ruleset:\s*(.+)$/im)?.[1]?.trim() || value.trim()
}

export function selectedRulesetFromSetupAnswers(answers: string[]) {
  const frame = answers.find((answer) => /^Ruleset:/im.test(answer))
  return frame ? supportedSystemFor(rulesetFromSetupAnswer(frame)) : supportedSystemFor('')
}
