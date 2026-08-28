export class MultiplayerError extends Error {
  status: number
  code: string

  constructor(message: string, status = 400, code = 'multiplayer_error') {
    super(message)
    this.name = 'MultiplayerError'
    this.status = status
    this.code = code
  }
}

export function multiplayerErrorResponse(error: unknown) {
  if (error instanceof MultiplayerError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status, headers: { 'Cache-Control': 'no-store' } })
  }
  const message = error instanceof Error ? error.message : 'Multiplayer is temporarily unavailable.'
  return Response.json({ error: message, code: 'multiplayer_unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
}
