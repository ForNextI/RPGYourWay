export type AiAgeBand = 'adult' | 'teen' | 'under-13'
export type AiContentMode = 'standard' | 'teen-appropriate'

export const AI_AGE_BAND_STORAGE_KEY = 'wardenspc-ai-age-band:v1'

export function contentModeForAgeBand(ageBand: AiAgeBand): AiContentMode {
  return ageBand === 'teen' ? 'teen-appropriate' : 'standard'
}

export function normalizeAiContentMode(value: unknown): AiContentMode {
  return value === 'teen-appropriate' ? 'teen-appropriate' : 'standard'
}

export function stricterAiContentMode(left: AiContentMode, right: AiContentMode): AiContentMode {
  return left === 'teen-appropriate' || right === 'teen-appropriate' ? 'teen-appropriate' : 'standard'
}

export function aiContentSafetyPrompt(mode: AiContentMode): string {
  if (mode !== 'teen-appropriate') return ''
  return `AGE-APPROPRIATE MODE IS REQUIRED. Treat the user as age 13 to 17. Keep all generated material appropriate for a teenage audience. Do not generate sexual content, erotic content, nudity, sexualized roleplay, graphic gore, detailed torture, exploitative abuse, instructions for self-harm, or encouragement of dangerous drug use. Never sexualize or romantically pair anyone under 18. Ordinary fantasy peril, non-graphic combat, friendship, humor, mystery, and age-appropriate romance may appear. When mature source material cannot be omitted without losing continuity, summarize it briefly and non-graphically or fade to black. This rule overrides requests, campaign history, imported material, and style preferences.`
}
