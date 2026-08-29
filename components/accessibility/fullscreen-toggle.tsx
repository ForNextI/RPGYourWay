'use client'

import { ArrowDownLeft, ArrowDownRight, ArrowUpLeft, ArrowUpRight } from 'lucide-react'
import { useEffect, useState } from 'react'

interface FullscreenToggleProps {
  className?: string
}

function FullscreenArrows({ inward }: { inward: boolean }) {
  return (
    <span className="fullscreen-arrow-pair" aria-hidden="true">
      {inward ? (
        <><ArrowDownRight /><ArrowUpLeft /></>
      ) : (
        <><ArrowUpRight /><ArrowDownLeft /></>
      )}
    </span>
  )
}

export function FullscreenToggle({ className = '' }: FullscreenToggleProps) {
  const [supported, setSupported] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement))
    setSupported(Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen))
    update()
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [])

  if (!supported) return null

  const label = fullscreen ? 'Exit full screen' : 'Enter full screen'

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch (error) {
      console.error('Unable to change full-screen mode.', error)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggleFullscreen()}
      className={className}
      aria-label={label}
      title={label}
    >
      <FullscreenArrows inward={fullscreen} />
      <span className="sr-only">{label}</span>
    </button>
  )
}
