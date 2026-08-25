export type TranscriptionContext = 'gameplay' | 'onboarding'

export const GAMEPLAY_TRANSCRIPTION_PROMPT = 'A tabletop roleplaying game turn. Preserve fantasy names, character names, place names, dice notation, D&D terminology, and natural punctuation.'
export const ONBOARDING_TRANSCRIPTION_PROMPT = 'A RPG Your Way onboarding message for Ithamir. Preserve character names, fantasy names, game-system names, D&D terminology, file and interface terms, numbers, and natural punctuation.'

const KNOWN_SILENCE_HALLUCINATIONS = [
  'You are a brave adventurer, venturing into the dark and mysterious dungeon. Your goal is to retrieve the lost artifact that lies within. As you make your way through the eerie corridors, you hear the sound of clinking chains ahead. Suddenly, a group of goblins jumps out from the shadows, ready to attack! Roll for initiative!',
] as const

function normalized(value: string) {
  return value
    .toLocaleLowerCase('en-US')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function withoutContextWrapper(value: string) {
  return normalized(value).replace(/^context\s+/, '')
}

export function transcriptionPromptFor(context: TranscriptionContext) {
  return context === 'onboarding' ? ONBOARDING_TRANSCRIPTION_PROMPT : GAMEPLAY_TRANSCRIPTION_PROMPT
}

export function isKnownPhantomTranscription(text: string) {
  const clean = withoutContextWrapper(text)
  if (!clean) return true

  const promptEchoes = [GAMEPLAY_TRANSCRIPTION_PROMPT, ONBOARDING_TRANSCRIPTION_PROMPT].map(normalized)
  if (promptEchoes.includes(clean)) return true

  return KNOWN_SILENCE_HALLUCINATIONS.some((candidate) => normalized(candidate) === clean)
}
