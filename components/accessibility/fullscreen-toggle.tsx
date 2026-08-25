'use client'

import { Maximize2, Minimize2 } from 'lucide-react'
import { useEffect, useState } from 'react'

interface FullscreenToggleProps {
  className?: string
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
      {fullscreen ? <Minimize2 className="size-4" aria-hidden="true" /> : <Maximize2 className="size-4" aria-hidden="true" />}
      <span className="sr-only">{label}</span>
    </button>
  )
}
