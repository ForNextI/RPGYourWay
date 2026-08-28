'use client'

export type AblyMessageLike = {
  id?: string
  clientId?: string
  data?: unknown
  timestamp?: number
}

export type AblyPresenceLike = {
  action?: string
  clientId?: string
  data?: unknown
}

type AblyHistoryPage = {
  items: AblyMessageLike[]
}

type AblyPresence = {
  enter(data?: unknown): Promise<void>
  leave(data?: unknown): Promise<void>
  get(): Promise<AblyPresenceLike[]>
  subscribe(listener: (message: AblyPresenceLike) => void): Promise<void> | void
  unsubscribe(listener?: (message: AblyPresenceLike) => void): void
}

export type AblyChannelLike = {
  presence: AblyPresence
  publish(name: string, data: unknown): Promise<void>
  subscribe(name: string, listener: (message: AblyMessageLike) => void): Promise<void> | void
  unsubscribe(name?: string, listener?: (message: AblyMessageLike) => void): void
  history(params?: { limit?: number; direction?: 'forwards' | 'backwards'; untilAttach?: boolean }): Promise<AblyHistoryPage>
}

export type AblyRealtimeLike = {
  channels: {
    get(name: string): AblyChannelLike
    release(name: string): void
  }
  connection: {
    state: string
    on(listener: (change: { current?: string; reason?: { message?: string } }) => void): void
    off(listener?: (change: { current?: string; reason?: { message?: string } }) => void): void
  }
  close(): void
}

type AblyConstructor = new (options: {
  authCallback: (
    tokenParams: unknown,
    callback: (error: Error | null, tokenRequest?: unknown) => void,
  ) => void
}) => AblyRealtimeLike

declare global {
  interface Window {
    Ably?: {
      Realtime: AblyConstructor
    }
  }
}

let loadingPromise: Promise<AblyConstructor> | null = null

export function loadAblyRealtime(): Promise<AblyConstructor> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Realtime is available only in the browser.'))
  if (window.Ably?.Realtime) return Promise.resolve(window.Ably.Realtime)
  if (loadingPromise) return loadingPromise

  loadingPromise = new Promise<AblyConstructor>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-rpgyw-ably="true"]')
    const script = existing ?? document.createElement('script')
    const finish = () => {
      if (window.Ably?.Realtime) resolve(window.Ably.Realtime)
      else reject(new Error('Ably loaded without a Realtime client.'))
    }
    const fail = () => reject(new Error('RPG Your Way could not load the multiplayer realtime client.'))

    if (existing) {
      existing.addEventListener('load', finish, { once: true })
      existing.addEventListener('error', fail, { once: true })
      if (window.Ably?.Realtime) finish()
      return
    }

    script.src = 'https://cdn.ably.com/lib/ably.min-2.js'
    script.async = true
    script.dataset.rpgywAbly = 'true'
    script.crossOrigin = 'anonymous'
    script.addEventListener('load', finish, { once: true })
    script.addEventListener('error', fail, { once: true })
    document.head.appendChild(script)
  }).catch((error) => {
    loadingPromise = null
    throw error
  })

  return loadingPromise
}
