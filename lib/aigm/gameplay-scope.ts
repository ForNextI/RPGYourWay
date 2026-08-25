export type GameplayScopeDecision = 'allow' | 'game_rejection' | 'unrelated'

export type GameplayScopeContext = {
  gameMasterName?: string
}

function normalized(message: string) {
  return message
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function strippedAddressee(value: string) {
  return value
    .replace(/^(?:miss|mister|mr|mrs|ms|sir|lady|lord|captain|master|mistress)\s+/, '')
    .replace(/[.!?]+$/, '')
    .trim()
}

function isOutOfWorldAddressee(value: string, context: GameplayScopeContext) {
  const addressee = strippedAddressee(normalized(value))
  const gameMasterName = normalized(context.gameMasterName || '')
  if (gameMasterName && addressee === gameMasterName) return true
  if (/^[a-z]$/.test(addressee)) return true

  return /^(?:you|chatgpt|aigm|ai|assistant|computer|wardenspc|game master|gm|dm|dungeon master|narrator)$/.test(addressee)
}

function vocativePrefix(text: string) {
  return text.match(/^(?:(?:so|okay|ok|well|all right|alright|hey),\s*)?((?:(?:miss|mister|mr|mrs|ms|sir|lady|lord|captain|master|mistress)\s+)?[a-z][a-z0-9'’-]*(?:\s+[a-z][a-z0-9'’-]*)?),\s*(?:can|could|would|will|do|did|tell|play|give|ask|show)\b/)
}

function hasOutOfWorldVocative(message: string, context: GameplayScopeContext) {
  const prefix = vocativePrefix(normalized(message))
  return Boolean(prefix && isOutOfWorldAddressee(prefix[1], context))
}

function hasNpcVocative(message: string, context: GameplayScopeContext) {
  const text = normalized(message)

  const prefix = vocativePrefix(text)
  if (prefix && !isOutOfWorldAddressee(prefix[1], context)) return true

  const suffix = text.match(/,\s*((?:(?:miss|mister|mr|mrs|ms|sir|lady|lord|captain|master|mistress)\s+)?[a-z][a-z0-9'’-]*(?:\s+[a-z][a-z0-9'’-]*)?)[.!?]*$/)
  if (!suffix) return false

  const addressee = normalized(suffix[1])
  if (/^(?:please|if possible|for me|right now|one more time|again|maybe|seriously|quickly|would you)$/.test(addressee)) return false
  return !isOutOfWorldAddressee(addressee, context)
}

function hasInWorldFraming(message: string, context: GameplayScopeContext) {
  const text = normalized(message)
  return hasNpcVocative(message, context)
    || /\b(?:i|we|my character|the party)\s+(?:ask|tell|challenge|invite|suggest|propose|order|beg|encourage)\s+(?!(?:you|aigm|the\s+(?:game master|gm|dm)|for|to)\b)[a-z0-9'’-]+/.test(text)
    || /\b(?:(?:i|we|my character|the party)\s+play|(?:can|could)\s+we\s+play)\s+(?:a\s+game\s+of\s+)?(?:10|ten|20|twenty)\s+questions\s+with\s+[^.!?]+/.test(text)
    || /\b(?:in[- ]?character|in the scene|in the game|in[- ]?world|as my character|as the party)\b/.test(text)
    || /\b(?:npc|bard|jester|fiddler|innkeeper|prisoner|suspect|guard|wizard|cleric|rogue|fighter)\b.{0,80}\b(?:tell|play|ask|joke|riddle|questions?)\b/.test(text)
}

function rejectsCurrentGame(text: string) {
  if (text.length > 320) return false
  return /\b(?:i\s+(?:hate|dislike|don'?t like)|(?:d&d|dungeons and dragons|this game|the game|this campaign|the campaign)\s+(?:is|feels)\s+(?:stupid|awful|terrible|boring|bad))\b.{0,100}\b(?:d&d|dungeons and dragons|this game|the game|this campaign|the campaign|playing)\b/.test(text)
    || /\b(?:stop|quit|end|pause)\s+(?:playing\s+)?(?:d&d|dungeons and dragons|this game|the game|this campaign|the campaign)\b/.test(text)
    || /\b(?:i\s+)?(?:don'?t|do not)\s+want\s+to\s+(?:play|continue)(?:\s+(?:d&d|dungeons and dragons|this game|the game|this campaign|the campaign))?\b/.test(text)
}

function directGeneralEntertainmentRequest(text: string) {
  return /^(?:please\s+)?(?:can|could|would|will)\s+you\s+(?:please\s+)?tell\s+(?:me|us)\s+(?:a|another|some)\s+joke\b/.test(text)
    || /^i\s+ask\s+(?:you\s+to\s+tell\s+(?:me|us)|for)\s+(?:a|another|some)\s+joke\b/.test(text)
    || /^(?:please\s+)?tell\s+(?:me|us)\s+(?:a|another|some)\s+joke\b/.test(text)
    || /^(?:please\s+)?(?:make\s+me\s+laugh|say\s+something\s+funny)\b/.test(text)
    || /^(?:let'?s|can\s+(?:we|you)|could\s+(?:we|you)|will\s+you|would\s+you|do\s+you\s+want\s+to)\s+play\s+(?:a\s+game\s+of\s+)?(?:10|ten|20|twenty)\s+questions\b/.test(text)
    || /^(?:let'?s|can\s+(?:we|you)|could\s+(?:we|you)|will\s+you|would\s+you)\s+play\s+(?:hangman|trivia|wordle|tic[- ]?tac[- ]?toe|chess|checkers|whist|would\s+you\s+rather)\b/.test(text)
    || /^(?:quiz\s+me|give\s+me\s+(?:a\s+)?(?:quiz|trivia\s+question|riddle))\b/.test(text)
}

export function gameplayScopeDecision(message: string, context: GameplayScopeContext = {}): GameplayScopeDecision {
  const text = normalized(message)
  if (!text) return 'allow'
  if (hasInWorldFraming(message, context)) return 'allow'
  if (hasOutOfWorldVocative(message, context)) return 'unrelated'
  if (rejectsCurrentGame(text)) return 'game_rejection'

  if (/\b(?:current events?|news headlines?|politics|election|president|congress|stock market|bitcoin|cryptocurrency|celebrity|justin bieber|write (?:me )?(?:an essay|code|a program|an email)|homework|translate this|medical diagnosis|legal advice)\b/i.test(text)) {
    return 'unrelated'
  }

  if (directGeneralEntertainmentRequest(text)) return 'unrelated'
  return 'allow'
}
