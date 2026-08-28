export type MultiplayerSessionStatus = 'lobby' | 'active' | 'paused' | 'closed'

export type MultiplayerCharacterSeat = {
  characterId: string
  displayName: string
  ordinal: number
}

export type MultiplayerParticipant = {
  seatId: string
  displayName: string
  /** A human participant may control any number of the campaign's available characters. */
  characterIds: string[]
  characterNames: string[]
  /** Compatibility helpers for UI/code that still wants a primary character. */
  characterId: string | null
  characterName: string | null
  isCoordinator: boolean
  isSelf: boolean
  realtimeClientId: string
}

export type MultiplayerSessionView = {
  id: string
  inviteCode: string
  campaignName: string
  campaignFingerprint: string
  status: MultiplayerSessionStatus
  coordinatorSeatId: string | null
  isCoordinator: boolean
  isMember: boolean
  selfSeatId: string | null
  inviteUrl: string
  expiresAt: string | null
  participants: MultiplayerParticipant[]
  characters: MultiplayerCharacterSeat[]
}

export type MultiplayerChatMessage = {
  id: string
  clientId: string
  seatId: string | null
  displayName: string
  text: string
  timestamp: number
  system?: boolean
}
