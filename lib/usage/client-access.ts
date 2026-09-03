export type UsageAccessStatus = 'ready' | 'account' | 'usage' | 'unavailable'

export type UsageAccessResult = {
  status: UsageAccessStatus
  availableMicrousd: number | null
  ownerQaExempt: boolean
}

export async function checkUsageAccess(): Promise<UsageAccessResult> {
  try {
    const response = await fetch('/api/usage/balance', { cache: 'no-store' })
    if (response.status === 401) {
      return { status: 'account', availableMicrousd: null, ownerQaExempt: false }
    }

    const payload = await response.json().catch(() => ({})) as {
      available_microusd?: unknown
      owner_qa_exempt?: unknown
      code?: unknown
    }

    if (response.status === 402 || payload.code === 'insufficient_balance') {
      return { status: 'usage', availableMicrousd: 0, ownerQaExempt: false }
    }
    if (!response.ok) {
      return { status: 'unavailable', availableMicrousd: null, ownerQaExempt: false }
    }

    const ownerQaExempt = payload.owner_qa_exempt === true
    const available = Number(payload.available_microusd)
    const availableMicrousd = Number.isFinite(available) ? Math.max(0, Math.trunc(available)) : 0
    if (ownerQaExempt || availableMicrousd > 0) {
      return { status: 'ready', availableMicrousd, ownerQaExempt }
    }
    return { status: 'usage', availableMicrousd, ownerQaExempt }
  } catch {
    return { status: 'unavailable', availableMicrousd: null, ownerQaExempt: false }
  }
}
