'use client'

import { Accessibility, X } from 'lucide-react'
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

type MotionPreference = 'system' | 'reduce' | 'full'

interface MotionContextValue {
  preference: MotionPreference
  reducedMotion: boolean
  setPreference: (preference: MotionPreference) => void
}

const STORAGE_KEY = 'wardenspc-motion-preference:v1'
const NOTICE_KEY = 'wardenspc-motion-notice-seen:v1'
const MotionContext = createContext<MotionContextValue | null>(null)

function storedPreference(): MotionPreference {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value === 'reduce' || value === 'full' ? value : 'system'
  } catch {
    return 'system'
  }
}

export function MotionPreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<MotionPreference>('system')
  const [systemReduced, setSystemReduced] = useState(false)
  const [showSystemNotice, setShowSystemNotice] = useState(false)

  useEffect(() => {
    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const noPreferenceQuery = window.matchMedia('(prefers-reduced-motion: no-preference)')
    const initialPreference = storedPreference()
    // Some embedded browsers have incorrectly reported both media queries as
    // true. Only honor reduced motion when the browser reports reduce and does
    // not simultaneously report the mutually exclusive no-preference value.
    const systemRequestsReduction = () => reduceQuery.matches && !noPreferenceQuery.matches
    const updateSystem = () => setSystemReduced(systemRequestsReduction())

    setPreferenceState(initialPreference)
    updateSystem()
    reduceQuery.addEventListener('change', updateSystem)
    noPreferenceQuery.addEventListener('change', updateSystem)

    if (initialPreference === 'system' && systemRequestsReduction()) {
      try {
        if (!window.localStorage.getItem(NOTICE_KEY)) setShowSystemNotice(true)
      } catch {
        setShowSystemNotice(true)
      }
    }

    return () => {
      reduceQuery.removeEventListener('change', updateSystem)
      noPreferenceQuery.removeEventListener('change', updateSystem)
    }
  }, [])

  const reducedMotion = preference === 'reduce' || (preference === 'system' && systemReduced)

  useEffect(() => {
    document.documentElement.dataset.motionPreference = preference
    document.documentElement.dataset.reducedMotion = reducedMotion ? 'true' : 'false'
  }, [preference, reducedMotion])

  function setPreference(value: MotionPreference) {
    setPreferenceState(value)
    setShowSystemNotice(false)
    try {
      if (value === 'system') window.localStorage.removeItem(STORAGE_KEY)
      else window.localStorage.setItem(STORAGE_KEY, value)
      window.localStorage.setItem(NOTICE_KEY, '1')
    } catch {
      // The setting still applies for the current page when storage is unavailable.
    }
  }

  function dismissNotice() {
    setShowSystemNotice(false)
    try {
      window.localStorage.setItem(NOTICE_KEY, '1')
    } catch {
      // No persistence is required for the setting itself to work.
    }
  }

  const value = useMemo<MotionContextValue>(() => ({ preference, reducedMotion, setPreference }), [preference, reducedMotion])

  return (
    <MotionContext.Provider value={value}>
      {children}
      {showSystemNotice && (
        <aside className="fixed bottom-4 left-4 right-4 z-[80] mx-auto max-w-xl rounded-2xl border border-primary/40 bg-card px-4 py-4 shadow-2xl" role="status" aria-live="polite">
          <div className="flex items-start gap-3">
            <Accessibility className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-display font-bold">Reduced motion is active</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Your device requests reduced motion, so Wardens PC has disabled scrolling text, flashing effects, and nonessential animation. You can review this under Motion settings in the footer.
              </p>
            </div>
            <button type="button" onClick={dismissNotice} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Dismiss reduced motion notice">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </aside>
      )}
    </MotionContext.Provider>
  )
}

export function useMotionPreference() {
  const value = useContext(MotionContext)
  if (!value) throw new Error('useMotionPreference must be used inside MotionPreferenceProvider.')
  return value
}

export function MotionSettingsControl({ compact = false }: { compact?: boolean } = {}) {
  const { preference, reducedMotion, setPreference } = useMotionPreference()
  const status = preference === 'system'
    ? `Device currently ${reducedMotion ? 'reduces motion' : 'allows motion'}`
    : preference === 'reduce'
      ? 'Motion reduced'
      : 'Motion allowed'

  if (compact) {
    return (
      <label className="motion-settings-control motion-settings-control--compact inline-flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded-xl border border-amber-200/35 bg-black/35 px-3 py-2 text-amber-100">
        <span className="shrink-0 text-xs font-bold uppercase tracking-[0.14em]">Motion</span>
        <select
          name="motionPreference"
          value={preference}
          onChange={(event) => setPreference(event.target.value as MotionPreference)}
          className="motion-settings-select motion-settings-select--compact min-w-0 max-w-[12rem] rounded-lg border border-amber-200/30 bg-black/45 px-2.5 py-1.5 text-xs text-amber-50"
          aria-label="Motion settings"
        >
          <option value="system">Use device setting</option>
          <option value="reduce">Reduce motion</option>
          <option value="full">Allow motion</option>
        </select>
        <span className="sr-only" aria-live="polite">{status}</span>
      </label>
    )
  }

  return (
    <label className="motion-settings-control flex min-w-0 max-w-full flex-col items-stretch gap-2">
      <span className="font-semibold text-foreground">Motion settings</span>
      <select
        id="wardens-motion-preference"
        name="motionPreference"
        value={preference}
        onChange={(event) => setPreference(event.target.value as MotionPreference)}
        className="motion-settings-select w-full min-w-0 max-w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
        aria-label="Motion settings"
      >
        <option value="system">Use device setting</option>
        <option value="reduce">Reduce motion</option>
        <option value="full">Allow motion</option>
      </select>
      <span
        className={preference === 'system' ? 'text-[11px] font-semibold text-muted-foreground' : 'sr-only'}
        aria-live="polite"
      >
        {status}
      </span>
    </label>
  )
}
