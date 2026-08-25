const SOURCE_REQUEST_PATTERN = /\b(?:source|sources|citation|citations|cite|cited|link|links|url|urls|where did you (?:find|get)|what (?:source|sources|site|sites|page|pages) did you use|show me (?:the )?(?:source|sources|citation|citations|link|links)|bibliography|references?)\b/i

export function playerRequestedLoreSources(message: string) {
  return SOURCE_REQUEST_PATTERN.test(message)
}

export function stripLoreSourceDecorations(value: string) {
  return value
    // Remove parenthetical citations such as ([site](https://example.com/...)).
    .replace(/\s*\(\s*\[[^\]]+\]\(https?:\/\/[^)]+\)\s*\)/gi, '')
    // Remove numbered or source-only markdown citations.
    .replace(/\s*\[(?:\d+|source|sources|citation|reference)\]\(https?:\/\/[^)]+\)/gi, '')
    // Keep useful linked words, but discard the destination URL.
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/gi, '$1')
    // Remove angle-bracketed and bare URLs that escaped markdown formatting.
    .replace(/\s*<https?:\/\/[^>]+>/gi, '')
    .replace(/\s*https?:\/\/\S+/gi, '')
    .replace(/\s*www\.[^\s)>\]]+/gi, '')
    // Remove dedicated source sections when the player did not ask for them.
    .replace(/(?:^|\n)\s*(?:sources?|citations?|references?)\s*:?\s*(?:\n(?:\s*[-*]\s*.*(?:https?:\/\/|www\.).*(?:\n|$))+|.*(?:https?:\/\/|www\.).*(?:\n|$)?)/gim, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()
}

export function playerFacingLoreText(value: string, playerMessage: string) {
  return playerRequestedLoreSources(playerMessage) ? value.trim() : stripLoreSourceDecorations(value)
}
