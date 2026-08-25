export type TerraUsage = {
  inputTokens: number
  cachedInputTokens?: number
  cacheWriteTokens?: number
  outputTokens: number
}

function count(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0
}

// GPT-5.6 Terra standard pricing, expressed as tenths of a micro-US-dollar per token:
// input $2/M = 20 tenths, cached $0.20/M = 2 tenths,
// cache-write $2.50/M = 25 tenths, output $12/M = 120 tenths.
// Requests above 272K input tokens use the provider's long-context multipliers.
export function terraCostMicrousd(usage: TerraUsage) {
  const input = count(usage.inputTokens)
  const cached = Math.min(input, count(usage.cachedInputTokens))
  const cacheWrite = Math.min(Math.max(0, input - cached), count(usage.cacheWriteTokens))
  const uncached = Math.max(0, input - cached - cacheWrite)
  const output = count(usage.outputTokens)
  const longContext = input > 272_000

  let inputTenths = cached * 2 + cacheWrite * 25 + uncached * 20
  let outputTenths = output * 120
  if (longContext) {
    inputTenths *= 2
    outputTenths = Math.ceil(outputTenths * 3 / 2)
  }
  return Math.ceil((inputTenths + outputTenths) / 10)
}

export function microusdCeilToCent(value: number) {
  const safe = Number.isFinite(value) && value > 0 ? Math.ceil(value) : 0
  return Math.ceil(safe / 10_000) * 10_000
}
