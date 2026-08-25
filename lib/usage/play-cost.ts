import { microusdCeilToCent, terraCostMicrousd } from '@/lib/usage/openai-cost'

const CHARS_PER_ESTIMATED_TOKEN = 3.5

export type NormalizedOpenAiUsage = {
  inputTokens: number
  cachedInputTokens: number
  cacheWriteTokens: number
  outputTokens: number
}

function count(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0
}

export function normalizeOpenAiUsage(value: unknown): NormalizedOpenAiUsage {
  if (!value || typeof value !== 'object') {
    return { inputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0 }
  }
  const payload = value as {
    usage?: unknown
    input_tokens?: unknown
    output_tokens?: unknown
    input_tokens_details?: { cached_tokens?: unknown; cache_write_tokens?: unknown }
  }
  const usage = payload.usage && typeof payload.usage === 'object'
    ? payload.usage as typeof payload
    : payload
  const inputTokens = count(usage.input_tokens)
  const cachedInputTokens = Math.min(inputTokens, count(usage.input_tokens_details?.cached_tokens))
  const cacheWriteTokens = Math.min(
    Math.max(0, inputTokens - cachedInputTokens),
    count(usage.input_tokens_details?.cache_write_tokens),
  )
  return {
    inputTokens,
    cachedInputTokens,
    cacheWriteTokens,
    outputTokens: count(usage.output_tokens),
  }
}

export function terraProviderCostMicrousd(value: unknown) {
  return terraCostMicrousd(normalizeOpenAiUsage(value))
}

export function estimateTerraMaximumMicrousd(
  inputCharacters: number,
  outputTokens = 6_000,
  safetyFactor = 1.55,
  minimumCents = 10,
) {
  const inputTokens = Math.max(1, Math.ceil(Math.max(0, inputCharacters) / CHARS_PER_ESTIMATED_TOKEN))
  // Assume the full prompt has to be written to cache. This deliberately errs high;
  // the final customer debit is based on actual successful provider usage.
  const estimated = terraCostMicrousd({
    inputTokens,
    cachedInputTokens: 0,
    cacheWriteTokens: inputTokens,
    outputTokens,
  })
  const minimum = Math.max(1, Math.round(minimumCents)) * 10_000
  return Math.max(minimum, microusdCeilToCent(estimated * safetyFactor))
}
