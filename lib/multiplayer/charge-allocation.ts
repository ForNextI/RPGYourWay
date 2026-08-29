/**
 * Integer-microdollar helpers for multiplayer turns.
 *
 * A whole turn is priced once, then divided across the frozen participating
 * seats. Remainders are distributed one microdollar at a time in seat order so
 * the payer shares always add back to the exact whole-turn amount.
 */
export function evenlyAllocateMultiplayerCharge(total: number, seatCount: number) {
  const safeTotal = Math.max(0, Math.trunc(total || 0))
  const safeCount = Math.max(1, Math.trunc(seatCount || 1))
  const base = Math.floor(safeTotal / safeCount)
  let remainder = safeTotal - base * safeCount
  return Array.from({ length: safeCount }, () => {
    const share = base + (remainder > 0 ? 1 : 0)
    if (remainder > 0) remainder -= 1
    return share
  })
}

export function aggregateMultiplayerPayerShares<T extends { payerUserId: string }>(seats: T[], shares: number[]) {
  const totals = new Map<string, number>()
  seats.forEach((seat, index) => {
    totals.set(seat.payerUserId, (totals.get(seat.payerUserId) || 0) + (shares[index] || 0))
  })
  return totals
}
