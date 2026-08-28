import assert from 'node:assert/strict'
import { microusdCeilToCent, terraCostMicrousd } from '../lib/usage/openai-cost.ts'

assert.equal(terraCostMicrousd({ inputTokens: 1_000_000, outputTokens: 0 }), 4_000_000, 'Long-context multiplier applies above 272K input tokens.')
assert.equal(terraCostMicrousd({ inputTokens: 100_000, outputTokens: 10_000 }), 320_000)
assert.equal(terraCostMicrousd({ inputTokens: 58_980, cachedInputTokens: 14_671, cacheWriteTokens: 44_266, outputTokens: 2_783 }), 147_082)
assert.equal(microusdCeilToCent(147_082), 150_000)
console.log('RPG Your Way provider-cost sanity checks passed.')
