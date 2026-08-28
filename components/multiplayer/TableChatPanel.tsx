'use client'

import { Check, Copy, LoaderCircle, MessageSquareText, Send, UsersRound, X } from 'lucide-react'
import { FormEvent, type RefObject, useEffect, useMemo, useRef, useState } from 'react'
import { loadAblyRealtime, type AblyMessageLike, type AblyPresenceLike, type AblyRealtimeLike } from '@/components/multiplayer/ably-browser'
import { MultiplayerPanelSwitcher, type MultiplayerSecondaryPanel } from '@/components/multiplayer/MultiplayerPanelSwitcher'
import type { MultiplayerChatMessage, MultiplayerSessionView } from '@/lib/multiplayer/types'

const MAX_CHAT_LENGTH = 1200

function messageData(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const text = typeof row.text === 'string' ? row.text.trim() : ''
  const seatId = typeof row.seatId === 'string' ? row.seatId : null
  if (!text) return null
  return { text: text.slice(0, MAX_CHAT_LENGTH), seatId }
}

function stableMessageId(message: AblyMessageLike, data: { text: string; seatId: string | null }) {
  return message.id || `${message.timestamp || 0}:${message.clientId || ''}:${data.seatId || ''}:${data.text}`
}

export function TableChatPanel({
  session,
  visible,
  activePanel,
  unreadCount,
  onUnreadCountChange,
  onPanelChange,
  onRefreshSession,
  onClaimCharacter,
  onLeaveSession,
  onCloseSession,
  onBackToPlay,
  showBackToPlay = true,
  showPanelSwitcher = true,
  panelRef,
}: {
  session: MultiplayerSessionView
  visible: boolean
  activePanel: MultiplayerSecondaryPanel
  unreadCount: number
  onUnreadCountChange: (count: number) => void
  onPanelChange: (panel: MultiplayerSecondaryPanel) => void
  onRefreshSession: () => Promise<void>
  onClaimCharacter: (characterId: string | null) => Promise<void>
  onLeaveSession: () => Promise<void>
  onCloseSession: () => Promise<void>
  onBackToPlay: () => void
  showBackToPlay?: boolean
  showPanelSwitcher?: boolean
  panelRef?: RefObject<HTMLElement | null>
}) {
  const [messages, setMessages] = useState<MultiplayerChatMessage[]>([])
  const [onlineClientIds, setOnlineClientIds] = useState<Set<string>>(new Set())
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'failed'>('connecting')
  const [connectionError, setConnectionError] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')
  const [seatBusy, setSeatBusy] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [closing, setClosing] = useState(false)
  const [screenReaderNotice, setScreenReaderNotice] = useState('')
  const realtimeRef = useRef<AblyRealtimeLike | null>(null)
  const logRef = useRef<HTMLDivElement | null>(null)
  const nearBottomRef = useRef(true)
  const visibleRef = useRef(visible)
  const unreadRef = useRef(unreadCount)
  const participantsRef = useRef(session.participants)

  useEffect(() => { visibleRef.current = visible }, [visible])
  useEffect(() => { unreadRef.current = unreadCount }, [unreadCount])
  useEffect(() => { participantsRef.current = session.participants }, [session.participants])

  const participantByClientId = useMemo(() => new Map(session.participants.map((participant) => [participant.realtimeClientId, participant])), [session.participants])
  const selfParticipant = session.participants.find((participant) => participant.isSelf) ?? null
  const selfCharacterId = selfParticipant?.characterId ?? ''
  const claimedByOther = useMemo(() => new Set(session.participants.filter((participant) => !participant.isSelf && participant.characterId).map((participant) => participant.characterId as string)), [session.participants])

  useEffect(() => {
    if (visible && unreadCount > 0) onUnreadCountChange(0)
  }, [visible, unreadCount, onUnreadCountChange])

  useEffect(() => {
    let cancelled = false
    let chatListener: ((message: AblyMessageLike) => void) | null = null
    let presenceListener: ((message: AblyPresenceLike) => void) | null = null
    let connectionListener: ((change: { current?: string; reason?: { message?: string } }) => void) | null = null
    let chatChannelName = ''
    let presenceChannelName = ''

    function resolveDisplayName(clientId: string | undefined, seatId: string | null) {
      const byClient = participantsRef.current.find((participant) => participant.realtimeClientId === clientId)
      const bySeat = seatId ? participantsRef.current.find((participant) => participant.seatId === seatId) : null
      return byClient?.displayName || bySeat?.displayName || 'Player'
    }

    function appendMessage(message: AblyMessageLike, fromHistory = false) {
      const data = messageData(message.data)
      if (!data) return
      const clientId = message.clientId || ''
      const displayName = resolveDisplayName(clientId, data.seatId)
      const chatMessage: MultiplayerChatMessage = {
        id: stableMessageId(message, data),
        clientId,
        seatId: data.seatId,
        displayName,
        text: data.text,
        timestamp: message.timestamp || Date.now(),
      }
      setMessages((current) => {
        if (current.some((entry) => entry.id === chatMessage.id)) return current
        return [...current, chatMessage].sort((a, b) => a.timestamp - b.timestamp).slice(-100)
      })
      if (!fromHistory && clientId !== selfParticipant?.realtimeClientId && !visibleRef.current) {
        const nextUnread = Math.min(99, unreadRef.current + 1)
        unreadRef.current = nextUnread
        onUnreadCountChange(nextUnread)
        setScreenReaderNotice(`New table chat message from ${displayName}. ${nextUnread} unread.`)
      }
    }

    async function connect() {
      if (!session.isMember || !session.selfSeatId) return
      setConnectionState('connecting')
      setConnectionError('')
      try {
        const Realtime = await loadAblyRealtime()
        if (cancelled) return
        const realtime = new Realtime({
          authCallback: (_tokenParams, callback) => {
            void fetch('/api/multiplayer/ably-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ inviteCode: session.inviteCode }),
            }).then(async (response) => {
              const payload = await response.json().catch(() => ({})) as Record<string, unknown>
              if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Could not authorize multiplayer realtime.')
              callback(null, payload)
            }).catch((error) => callback(error instanceof Error ? error : new Error('Could not authorize multiplayer realtime.')))
          },
        })
        realtimeRef.current = realtime
        chatChannelName = `rpg-mp:${session.id}:chat`
        presenceChannelName = `rpg-mp:${session.id}:presence`
        const chatChannel = realtime.channels.get(chatChannelName)
        const presenceChannel = realtime.channels.get(presenceChannelName)

        connectionListener = (change) => {
          const current = change.current || realtime.connection.state
          if (current === 'connected') {
            setConnectionState('connected')
            setConnectionError('')
          } else if (current === 'failed') {
            setConnectionState('failed')
            setConnectionError(change.reason?.message || 'Realtime connection failed.')
          } else if (current === 'disconnected' || current === 'suspended' || current === 'closed') {
            setConnectionState('disconnected')
          } else {
            setConnectionState('connecting')
          }
        }
        realtime.connection.on(connectionListener)

        chatListener = (message) => appendMessage(message)
        await chatChannel.subscribe('human-chat', chatListener)

        try {
          const history = await chatChannel.history({ limit: 50, direction: 'backwards', untilAttach: true })
          for (const message of [...history.items].reverse()) appendMessage(message, true)
        } catch {
          // History improves a reconnect but should never prevent a live chat connection.
        }

        presenceListener = (message) => {
          const clientId = message.clientId || ''
          if (!clientId) return
          setOnlineClientIds((current) => {
            const next = new Set(current)
            if (message.action === 'leave' || message.action === 'absent') next.delete(clientId)
            else next.add(clientId)
            return next
          })
          if (message.action === 'enter' || message.action === 'leave') {
            const participant = participantsRef.current.find((entry) => entry.realtimeClientId === clientId)
            if (participant && clientId !== selfParticipant?.realtimeClientId) {
              setScreenReaderNotice(`${participant.displayName} ${message.action === 'enter' ? 'joined' : 'left'} the multiplayer table.`)
            }
            void onRefreshSession()
          }
        }
        await presenceChannel.presence.subscribe(presenceListener)
        await presenceChannel.presence.enter({ seatId: session.selfSeatId })
        const present = await presenceChannel.presence.get()
        if (!cancelled) setOnlineClientIds(new Set(present.map((entry) => entry.clientId).filter((value): value is string => Boolean(value))))
      } catch (error) {
        if (!cancelled) {
          setConnectionState('failed')
          setConnectionError(error instanceof Error ? error.message : 'Could not connect to multiplayer realtime.')
        }
      }
    }

    void connect()
    return () => {
      cancelled = true
      const realtime = realtimeRef.current
      if (!realtime) return
      try {
        if (connectionListener) realtime.connection.off(connectionListener)
        if (chatChannelName && chatListener) realtime.channels.get(chatChannelName).unsubscribe('human-chat', chatListener)
        if (presenceChannelName && presenceListener) realtime.channels.get(presenceChannelName).presence.unsubscribe(presenceListener)
        if (presenceChannelName) void realtime.channels.get(presenceChannelName).presence.leave().catch(() => undefined)
      } catch {
        // Closing a browser or switching campaigns can race with Ably cleanup.
      }
      realtime.close()
      realtimeRef.current = null
    }
  }, [session.id, session.inviteCode, session.isMember, session.selfSeatId, selfParticipant?.realtimeClientId, onRefreshSession, onUnreadCountChange])

  useEffect(() => {
    if (!visible || !logRef.current || !nearBottomRef.current) return
    const frame = window.requestAnimationFrame(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
    })
    return () => window.cancelAnimationFrame(frame)
  }, [messages, visible])

  async function sendMessage(event: FormEvent) {
    event.preventDefault()
    const text = draft.replace(/\s+/g, ' ').trim().slice(0, MAX_CHAT_LENGTH)
    const realtime = realtimeRef.current
    if (!text || !realtime || !session.selfSeatId || sending) return
    setSending(true)
    try {
      const channel = realtime.channels.get(`rpg-mp:${session.id}:chat`)
      await channel.publish('human-chat', { text, seatId: session.selfSeatId })
      setDraft('')
      nearBottomRef.current = true
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'That chat message could not be sent.')
    } finally {
      setSending(false)
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(session.inviteUrl)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1800)
    } catch {
      setConnectionError('Copy did not work. Select the invite link and copy it manually.')
    }
  }

  async function chooseCharacter(value: string) {
    setSeatBusy(true)
    try {
      await onClaimCharacter(value || null)
    } finally {
      setSeatBusy(false)
    }
  }

  async function leaveSession() {
    if (!window.confirm('Leave this multiplayer session? Your player seat will be freed for someone else.')) return
    setLeaving(true)
    try {
      await onLeaveSession()
    } finally {
      setLeaving(false)
    }
  }

  async function closeSession() {
    if (!window.confirm('Close this multiplayer session for everyone?')) return
    setClosing(true)
    try {
      await onCloseSession()
    } finally {
      setClosing(false)
    }
  }

  const connectedCount = session.participants.filter((participant) => onlineClientIds.has(participant.realtimeClientId)).length

  return (
    <aside ref={panelRef} tabIndex={-1} className={`aigm-table-chat-panel aigm-mp-secondary ${activePanel === 'chat' ? 'aigm-mp-secondary--active' : ''} ${visible ? 'aigm-table-chat-panel--visible' : ''}`} aria-label="Table chat">
      {showBackToPlay ? <button type="button" onClick={onBackToPlay} className="aigm-mp-back-to-play">Back to Play</button> : null}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{screenReaderNotice}</div>

      <header className="aigm-table-chat-heading">
        <div>
          <p className="aigm-table-chat-eyebrow">Multiplayer</p>
          <h2><MessageSquareText aria-hidden="true" />Table Chat</h2>
        </div>
        <span className={`aigm-table-chat-connection aigm-table-chat-connection--${connectionState}`}>
          {connectionState === 'connected' ? `${connectedCount || 1} online` : connectionState === 'connecting' ? 'Connecting…' : connectionState === 'failed' ? 'Connection failed' : 'Reconnecting…'}
        </span>
      </header>

      <details className="aigm-multiplayer-lobby-details">
        <summary><UsersRound aria-hidden="true" />Table setup · {session.participants.length}/6 players</summary>
        <div className="aigm-multiplayer-lobby-body">
          <div className="aigm-multiplayer-invite-row">
            <label htmlFor="multiplayer-invite-url">Invite link</label>
            <div>
              <input id="multiplayer-invite-url" readOnly value={session.inviteUrl} onFocus={(event) => event.currentTarget.select()} />
              <button type="button" onClick={copyInvite}>{copyState === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}<span>{copyState === 'copied' ? 'Copied' : 'Copy'}</span></button>
            </div>
          </div>

          <div className="aigm-multiplayer-participants" aria-label="Players in this multiplayer table">
            {session.participants.map((participant) => (
              <div key={participant.seatId} className="aigm-multiplayer-participant">
                <span className={`aigm-presence-dot ${onlineClientIds.has(participant.realtimeClientId) ? 'aigm-presence-dot--online' : ''}`} aria-hidden="true" />
                <span><strong>{participant.displayName}{participant.isSelf ? ' (you)' : ''}</strong>{participant.characterName ? ` · ${participant.characterName}` : ' · no character selected'}</span>
                {participant.isCoordinator ? <span className="aigm-coordinator-badge">Coordinator</span> : null}
              </div>
            ))}
          </div>

          {selfParticipant ? (
            <div className="aigm-multiplayer-character-choice">
              <label htmlFor="multiplayer-character-seat">Your character</label>
              <select id="multiplayer-character-seat" value={selfCharacterId} disabled={seatBusy} onChange={(event) => void chooseCharacter(event.target.value)}>
                <option value="">Choose a character…</option>
                {session.characters.map((character) => (
                  <option key={character.characterId} value={character.characterId} disabled={claimedByOther.has(character.characterId)}>
                    {character.displayName}{claimedByOther.has(character.characterId) ? ' · already taken' : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {session.isCoordinator ? (
            <button type="button" className="aigm-close-multiplayer" disabled={closing} onClick={() => void closeSession()}>
              {closing ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <X aria-hidden="true" />}Close multiplayer session
            </button>
          ) : (
            <button type="button" className="aigm-leave-multiplayer" disabled={leaving} onClick={() => void leaveSession()}>
              {leaving ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <X aria-hidden="true" />}Leave multiplayer table
            </button>
          )}
        </div>
      </details>

      {connectionError ? <p className="aigm-table-chat-error" role="alert">{connectionError}</p> : null}

      <div
        ref={logRef}
        className="aigm-table-chat-log"
        role="log"
        aria-label="Table chat messages"
        aria-live="off"
        onScroll={(event) => {
          const element = event.currentTarget
          nearBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 64
        }}
      >
        {messages.length === 0 ? (
          <p className="aigm-table-chat-empty">Human table conversation appears here. Chat is not sent to the AIGM and does not use AI balance.</p>
        ) : messages.map((message) => (
          <article key={message.id} className={`aigm-table-chat-message ${message.clientId === selfParticipant?.realtimeClientId ? 'aigm-table-chat-message--self' : ''}`}>
            <p className="aigm-table-chat-message-meta"><strong>{participantByClientId.get(message.clientId)?.displayName || message.displayName}</strong><time dateTime={new Date(message.timestamp).toISOString()}>{new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></p>
            <p>{message.text}</p>
          </article>
        ))}
      </div>

      <form className="aigm-table-chat-composer" onSubmit={sendMessage}>
        <label className="sr-only" htmlFor="table-chat-message">Message the other players</label>
        <textarea id="table-chat-message" value={draft} onChange={(event) => setDraft(event.target.value.slice(0, MAX_CHAT_LENGTH))} maxLength={MAX_CHAT_LENGTH} rows={2} placeholder="Type a message to the table…" disabled={connectionState !== 'connected' || sending} />
        <button type="submit" disabled={!draft.trim() || connectionState !== 'connected' || sending} aria-label="Send table chat message">{sending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}</button>
      </form>

      {showPanelSwitcher ? <MultiplayerPanelSwitcher active={activePanel} unreadCount={unreadCount} onChange={onPanelChange} className="aigm-mp-desktop-switcher" /> : null}
    </aside>
  )
}
