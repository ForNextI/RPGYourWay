import assert from 'node:assert/strict'
import { formatUsageDollars, signedUsageDollars, usageMicrousd } from '../lib/usage/money.ts'

assert.equal(usageMicrousd(1_250_000), 1_250_000)
assert.equal(usageMicrousd('4250000'), 4_250_000)
assert.equal(usageMicrousd(-1), 0)
assert.equal(formatUsageDollars(0), '$0.00')
assert.equal(formatUsageDollars(4_250_000), '$4.25')
assert.equal(formatUsageDollars('13500000'), '$13.50')
assert.equal(signedUsageDollars(250_000), '+$0.25')
assert.equal(signedUsageDollars(-1_250_000), '−$1.25')

console.log('RPG Your Way usage-money sanity checks passed.')
