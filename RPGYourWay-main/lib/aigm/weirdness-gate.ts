export type WeirdnessGateStatus = 'none' | 'awaiting_player_roll' | 'armed' | 'red_herring_countdown'

export interface WeirdnessGate {
  status: WeirdnessGateStatus
  threshold: number
  opened_at_turn: number
  purpose_hint: string
  trigger_after_turn: number
  resolve_by_turn: number
  red_herring_exchanges_remaining: number
}

export function emptyWeirdnessGate(): WeirdnessGate {
  return {
    status: 'none',
    threshold: 0,
    opened_at_turn: 0,
    purpose_hint: '',
    trigger_after_turn: 0,
    resolve_by_turn: 0,
    red_herring_exchanges_remaining: 0,
  }
}

export function failedWeirdnessGate(delay: number, openedAtTurn: number): WeirdnessGate {
  return {
    status: 'red_herring_countdown',
    threshold: 0,
    opened_at_turn: Math.max(0, Math.floor(openedAtTurn)),
    purpose_hint: '',
    trigger_after_turn: 0,
    resolve_by_turn: 0,
    red_herring_exchanges_remaining: Math.min(12, Math.max(1, Math.floor(delay))),
  }
}

export function advanceFailedWeirdnessGate(
  gate: WeirdnessGate,
  countsAsExchange: boolean,
): { due: boolean; nextGate: WeirdnessGate } {
  if (gate.status !== 'red_herring_countdown' || !countsAsExchange) {
    return { due: false, nextGate: gate }
  }

  if (gate.red_herring_exchanges_remaining <= 1) {
    return { due: true, nextGate: emptyWeirdnessGate() }
  }

  return {
    due: false,
    nextGate: {
      ...gate,
      red_herring_exchanges_remaining: gate.red_herring_exchanges_remaining - 1,
    },
  }
}
