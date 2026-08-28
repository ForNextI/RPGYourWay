'use client'

import { useEffect, useState } from 'react'

export function FullscreenToggle() {
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
      className="fullscreen-toggle"
      onClick={() => void toggleFullscreen()}
      aria-label={label}
      title={label}
    >
      {fullscreen ? (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" />
          <path d="M3 9l6-6M21 9l-6-6M3 15l6 6M21 15l-6 6" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M9 9 3 3M3 3v6M3 3h6M15 9l6-6M21 3v6M21 3h-6M9 15l-6 6M3 21v-6M3 21h6M15 15l6 6M21 21v-6M21 21h-6" />
        </svg>
      )}
      <span className="sr-only">{label}</span>
    </button>
  )
}
