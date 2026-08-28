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

  const leaveSession = useCallback(async () => {
    const code = session?.inviteCode
    if (!code) return
    setError('')
    const response = await fetch(`/api/multiplayer/sessions/${encodeURIComponent(code)}/leave`, { method: 'POST' })
    const payload = await response.json().catch(() => ({})) as { error?: string }
    if (!response.ok) {
      const leaveError = new Error(payload.error || 'Could not leave the multiplayer session.')
      setError(leaveError.message)
      throw leaveError
    }
    setSession(null)
    putMultiplayerCodeInUrl(null)
  }, [session?.inviteCode])

  const closeSession = useCallback(async () => {
    const code = session?.inviteCode
    if (!code) return
    setError('')
    const response = await fetch(`/api/multiplayer/sessions/${encodeURIComponent(code)}/close`, { method: 'POST' })
    const payload = await response.json().catch(() => ({})) as { error?: string }
    if (!response.ok) {
      const closeError = new Error(payload.error || 'Could not close the multiplayer session.')
      setError(closeError.message)
      throw closeError
    }
    setSession(null)
    putMultiplayerCodeInUrl(null)
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
    leaveSession,
    closeSession,
  }
}
