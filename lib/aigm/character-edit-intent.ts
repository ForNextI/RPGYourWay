export interface CharacterEditIntent {
  broadRefresh: boolean
  rulesRefresh: boolean
}

function normalizeIntentText(value: string) {
  return value.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().toLocaleLowerCase('en-US')
}

export function classifyCharacterEditIntent(value: string): CharacterEditIntent {
  const text = normalizeIntentText(value)
  const explicitRulesRefresh = /\b(?:fill(?:\s+in)?|add|update|refresh|enrich|complete|populate)\b.{0,120}\b(?:missing\s+)?(?:rules?|rule\s+details?|rules\s+details?|srd)\b/i.test(text)
    || /\b(?:rules?|rule\s+details?|rules\s+details?|srd)\b.{0,120}\b(?:fill(?:\s+in)?|add|update|refresh|enrich|complete|populate)\b/i.test(text)

  const broadRefresh = /\bfill(?:\s+in)?\s+(?:all|every)\s+(?:of\s+)?(?:the\s+)?(?:missing\s+)?(?:details?|information)\b/i.test(text)
    || /\b(?:fill(?:\s+in)?|add|update|refresh|enrich|complete|populate)\b.{0,80}\b(?:all\s+(?:the\s+)?(?:missing\s+)?details?|all\s+(?:the\s+)?(?:missing\s+)?information|everything)\b/i.test(text)
    || /\b(?:fill(?:\s+in)?|add|update|refresh|enrich|complete|populate)\b.{0,80}\bwhatever\s+(?:you\s+)?(?:have|got|know|can)\b/i.test(text)
    || /\b(?:everything|all\s+(?:the\s+)?(?:missing\s+)?details?|all\s+(?:the\s+)?(?:missing\s+)?information)\b.{0,80}\b(?:you\s+)?(?:have|got|know|can)\b/i.test(text)

  return {
    broadRefresh,
    // A request for every available detail necessarily includes every safely available rules detail.
    rulesRefresh: explicitRulesRefresh || broadRefresh,
  }
}
