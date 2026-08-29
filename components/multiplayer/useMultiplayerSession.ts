'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MultiplayerSessionView } from '@/lib/multiplayer/types'

type SessionPayload = { session?: MultiplayerSessionView; error?: string }

class MultiplayerRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'MultiplayerRequestError'
    this.status = status
  }
}

function multiplayerCodeFromUrl() {
  if (typeof window === 'undefined') return ''
  return new URL(window.location.href).searchParams.get('multiplayer')?.trim() || ''
}

function putMultiplayerCodeInUrl(code: string | null) {
  const url = new URL(window.location.href)
  if (code) url.searchParams.set('multiplayer', code)
  else url.searchParams.delete('multiplayer')
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}

async function sessionResponse(response: Response) {
  const payload = await response.json().catch(() => ({})) as SessionPayload
  if (!response.ok || !payload.session) throw new MultiplayerRequestError(payload.error || 'Multiplayer is temporarily unavailable.', response.status)
  return payload.session
}

export function useMultiplayerSession() {
  const [session, setSession] = useState<MultiplayerSessionView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)

  const loadInvite = useCallback(async (inviteCode: string, joinIfNeeded = true) => {
    const code = inviteCode.trim()
    if (!code) return null
    setLoading(true)
    setError('')
    try {
      let current = await sessionResponse(await fetch(`/api/multiplayer/sessions/${encodeURIComponent(code)}`, { cache: 'no-store' }))
      if (!current.isMember && joinIfNeeded) {
        current = await sessionResponse(await fetch(`/api/multiplayer/sessions/${encodeURIComponent(code)}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }))
      }
      setSession(current)
      putMultiplayerCodeInUrl(current.inviteCode)
      return current
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Could not open that multiplayer invite.'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const code = multiplayerCodeFromUrl()
    if (code) void loadInvite(code)
  }, [loadInvite])

  const refreshSession = useCallback(async () => {
    const code = session?.inviteCode || multiplayerCodeFromUrl()
    if (!code) return
    try {
      const current = await sessionResponse(await fetch(`/api/multiplayer/sessions/${encodeURIComponent(code)}`, { cache: 'no-store' }))
      setSession(current)
      setError('')
    } catch (refreshError) {
      if (refreshError instanceof MultiplayerRequestError && (refreshError.status === 404 || refreshError.status === 410)) {
        setSession(null)
        putMultiplayerCodeInUrl(null)
      }
      setError(refreshError instanceof Error ? refreshError.message : 'Could not refresh the multiplayer table.')
    }
  }, [session?.inviteCode])

  useEffect(() => {
    if (!session?.inviteCode) return
    const interval = window.setInterval(() => { void refreshSession() }, 4_000)
    return () => window.clearInterval(interval)
  }, [session?.inviteCode, refreshSession])

  useEffect(() => {
    const code = session?.inviteCode
    if (!code) return
    const heartbeatUrl = `/api/multiplayer/sessions/${encodeURIComponent(code)}/heartbeat`
    let cancelled = false
    async function heartbeat() {
      try {
        const current = await sessionResponse(await fetch(heartbeatUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }))
        if (!cancelled) setSession(current)
      } catch {
        // The normal refresh path owns visible connection errors. Heartbeat is
        // only the billing/presence freshness signal for participating seats.
      }
    }
    void heartbeat()
    const interval = window.setInterval(() => { void heartbeat() }, 30_000)
    return () => { cancelled = true; window.clearInterval(interval) }
  }, [session?.inviteCode])

  const startSession = useCallback(async (input: {
    localCampaignId: string
    campaignName: string
    characters: Array<{ characterId: string; displayName: string }>
  }) => {
    if (starting) return null
    setStarting(true)
    setError('')
    try {
      const current = await sessionResponse(await fetch('/api/multiplayer/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }))
      setSession(current)
      putMultiplayerCodeInUrl(current.inviteCode)
      return current
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Could not start multiplayer.')
      return null
    } finally {
      setStarting(false)
    }
  }, [starting])

  const setCharacterClaim = useCallback(async (characterId: string, claimed: boolean) => {
    const code = session?.inviteCode
    if (!code) return
    setError('')
    try {
      const current = await sessionResponse(await fetch(`/api/multiplayer/sessions/${encodeURIComponent(code)}/seat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId, claimed }),
      }))
      setSession(current)
    } catch (claimError) {
      const message = claimError instanceof Error ? claimError.message : 'Could not change your multiplayer characters.'
      setError(message)
      throw claimError
    }
  }, [session?.inviteCode])

  const updateDisplayName = useCallback(async (displayName: string) => {
    const code = session?.inviteCode
    if (!code) return
    setError('')
    try {
      const current = await sessionResponse(await fetch(`/api/multiplayer/sessions/${encodeURIComponent(code)}/display-name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName }),
      }))
      setSession(current)
      return current
    } catch (nameError) {
      const message = nameError instanceof Error ? nameError.message : 'Could not change your chat name.'
      setError(message)
      throw nameError
    }
  }, [session?.inviteCode])

  const syncCharacters = useCallback(async (characters: Array<{ characterId: string; displayName: string }>) => {
    const code = session?.inviteCode
    if (!code || !session?.isCoordinator) return null
    setError('')
    try {
      const current = await sessionResponse(await fetch(`/api/multiplayer/sessions/${encodeURIComponent(code)}/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characters }),
      }))
      setSession(current)
      return current
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Could not update the multiplayer character roster.')
      return null
    }
  }, [session?.inviteCode, session?.isCoordinator])


  const prepareTurn = useCallback(async (turnId: string, expectedRevision: number) => {
    const code = session?.inviteCode || multiplayerCodeFromUrl()
    if (!code) return null
    setError('')
    const response = await fetch(`/api/multiplayer/sessions/${encodeURIComponent(code)}/turns/${encodeURIComponent(turnId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expected_revision: expectedRevision }),
    })
    const payload = await response.json().catch(() => ({})) as { turn?: { turnId?: string }; error?: string }
    if (!response.ok || !payload.turn) {
      const error = new MultiplayerRequestError(payload.error || 'RPG Your Way could not reserve this multiplayer turn.', response.status)
      setError(error.message)
      throw error
    }
    return payload.turn
  }, [session?.inviteCode])

  const completeTurn = useCallback(async (turnId: string, finalRevision: number) => {
    const code = session?.inviteCode || multiplayerCodeFromUrl()
    if (!code) return null
    let lastError: unknown = null
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(`/api/multiplayer/sessions/${encodeURIComponent(code)}/turns/${encodeURIComponent(turnId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'complete', final_revision: finalRevision }),
        })
        const current = await sessionResponse(response)
        setSession(current)
        setError('')
        return current
      } catch (completeError) {
        lastError = completeError
        if (attempt === 0) await new Promise<void>((resolve) => window.setTimeout(resolve, 350))
      }
    }
    throw lastError instanceof Error ? lastError : new Error('RPG Your Way could not acknowledge the committed multiplayer turn.')
  }, [session?.inviteCode])

  const releaseTurn = useCallback(async (turnId: string) => {
    const code = session?.inviteCode || multiplayerCodeFromUrl()
    if (!code) return
    await fetch(`/api/multiplayer/sessions/${encodeURIComponent(code)}/turns/${encodeURIComponent(turnId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'release' }),
    }).catch(() => undefined)
  }, [session?.inviteCode])


  return {
    session,
    loading,
    starting,
    error,
    setError,
    startSession,
    refreshSession,
    setCharacterClaim,
    updateDisplayName,
    syncCharacters,
    prepareTurn,
    completeTurn,
    releaseTurn,
  }
}
