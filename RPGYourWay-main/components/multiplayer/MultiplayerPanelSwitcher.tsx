'use client'

import { Dices, MessageSquareText, UserRound } from 'lucide-react'

export type MultiplayerSecondaryPanel = 'chat' | 'tools' | 'characters'

export function MultiplayerPanelSwitcher({
  active,
  unreadCount,
  onChange,
  className = '',
}: {
  active: MultiplayerSecondaryPanel
  unreadCount: number
  onChange: (panel: MultiplayerSecondaryPanel) => void
  className?: string
}) {
  const buttonClass = (panel: MultiplayerSecondaryPanel) => `multiplayer-panel-switcher-button ${active === panel ? 'multiplayer-panel-switcher-button--active' : ''}`
  return (
    <nav className={`multiplayer-panel-switcher ${className}`.trim()} aria-label="Multiplayer side panels">
      <button type="button" className={buttonClass('chat')} aria-pressed={active === 'chat'} onClick={() => onChange('chat')}>
        <MessageSquareText aria-hidden="true" />
        <span>Chat{unreadCount > 0 ? ` (${unreadCount})` : ''}</span>
      </button>
      <button type="button" className={buttonClass('tools')} aria-pressed={active === 'tools'} onClick={() => onChange('tools')}>
        <Dices aria-hidden="true" />
        <span>Dice</span>
      </button>
      <button type="button" className={buttonClass('characters')} aria-pressed={active === 'characters'} onClick={() => onChange('characters')}>
        <UserRound aria-hidden="true" />
        <span>Characters</span>
      </button>
    </nav>
  )
}
