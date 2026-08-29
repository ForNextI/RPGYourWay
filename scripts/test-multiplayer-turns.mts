import assert from 'node:assert/strict'
import { aggregateMultiplayerPayerShares, evenlyAllocateMultiplayerCharge } from '../lib/multiplayer/charge-allocation.ts'

assert.deepEqual(evenlyAllocateMultiplayerCharge(10_000, 3), [3334, 3333, 3333])
assert.deepEqual(evenlyAllocateMultiplayerCharge(1, 6), [1, 0, 0, 0, 0, 0])
assert.equal(evenlyAllocateMultiplayerCharge(12_345, 4).reduce((sum, value) => sum + value, 0), 12_345)

const seats = [
  { payerUserId: 'payer-a' },
  { payerUserId: 'payer-b' },
  { payerUserId: 'payer-a' },
  { payerUserId: 'payer-c' },
]
const shares = evenlyAllocateMultiplayerCharge(10_003, seats.length)
const payers = aggregateMultiplayerPayerShares(seats, shares)
assert.equal([...payers.values()].reduce((sum, value) => sum + value, 0), 10_003)
assert.equal(payers.get('payer-a'), shares[0] + shares[2])
assert.equal(payers.get('payer-b'), shares[1])
assert.equal(payers.get('payer-c'), shares[3])

console.log('RPG Your Way multiplayer turn allocation checks passed.')
