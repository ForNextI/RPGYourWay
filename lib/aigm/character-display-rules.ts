const EMPTY_SUBCLASS = /^(?:\(?\s*(?:subclass\s*[:—-]?\s*)?(?:(?:available|gained|chosen|selected)\s+)?(?:at|from|until)?\s*(?:[a-z][a-z '-]*\s+)?level\s*\d+\s*\)?|(?:none|not selected|not specified|not applicable|n\/?a)(?:\s+(?:at|until)\s+(?:[a-z][a-z '-]*\s+)?level\s*\d+)?|no\s+subclass(?:\s+(?:at|until)\s+(?:[a-z][a-z '-]*\s+)?level\s*\d+)?|subclass\s+(?:is\s+)?(?:not\s+available|not\s+chosen|not\s+selected)(?:\s+until\s+(?:[a-z][a-z '-]*\s+)?level\s*\d+)?)$/i

const EMPTY_SPELL_ENTRY = /^(?:none|n\/?a|not applicable|nothing(?:\s+(?:was\s+)?recorded)?(?:\s+in\s+(?:this|the)\s+section)?|no entries?|not recorded)[.!]?$/i
const LEVEL_GATED_RECORD_ENTRY = /^(?:(?:does(?:\s+not|n't)|do(?:\s+not|n't)|cannot|can't|not|none|no)\b.*\b(?:until|before|at|from)\b.*\blevel\s*\d+\b|(?:available|gained|received|learned|unlocked|starts?)\b.*\blevel\s*\d+\b)/i
const SPELL_NON_INFORMATION = /\b(?:cantrips?|spells?|spellbooks?|spellcasting)\b.*\b(?:none|not\s+applicable|not\s+available|not\s+used|not\s+required|does(?:\s+not|n't)|do(?:\s+not|n't)|cannot|can't|until\s+(?:[a-z][a-z '-]*\s+)?level\s*\d+|(?:available|gained|received|learned|unlocked)\s+(?:at|from)\s+(?:[a-z][a-z '-]*\s+)?level\s*\d+)\b/i
const REVERSED_SPELL_NON_INFORMATION = /(?:^(?:no|none)\b.*\b(?:cantrips?|spells?|spellbooks?|spellcasting)\b|\b(?:does(?:\s+not|n't)|do(?:\s+not|n't)|cannot|can't)\b.*\b(?:use|have|need|learn|prepare|receive|get)\b.*\b(?:cantrips?|spells?|spellbooks?|spellcasting)\b)/i

export function cleanSubclass(value: string | null | undefined) {
  const clean = typeof value === 'string' ? value.trim() : ''
  if (!clean || EMPTY_SUBCLASS.test(clean)) return ''
  const clauses = clean.split(';').map((clause) => clause.trim()).filter(Boolean)
  if (clauses.length > 1) {
    const firstClauseEmpty = /^(?:none|no subclass|not selected|not specified|not applicable|n\/?a)(?:\s+(?:at|until)\s+(?:[a-z][a-z '-]*\s+)?level\s*\d+)?$/i.test(clauses[0])
    const remainingAreFutureGates = clauses.slice(1).every((clause) => /\b(?:gained|chosen|selected|available|received|begins?)\b.*\blevel\s*\d+\b/i.test(clause))
    if (firstClauseEmpty && remainingAreFutureGates) return ''
  }
  return clean
}

export function cleanSpellDisplayEntries(items: string[] | null | undefined) {
  return (items ?? []).flatMap((raw) => {
    const clean = typeof raw === 'string' ? raw.trim() : ''
    if (!clean) return []
    if (EMPTY_SPELL_ENTRY.test(clean) || LEVEL_GATED_RECORD_ENTRY.test(clean) || SPELL_NON_INFORMATION.test(clean) || REVERSED_SPELL_NON_INFORMATION.test(clean)) return []
    return [clean]
  })
}
