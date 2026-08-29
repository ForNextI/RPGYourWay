import type { AdventureSummary, CampaignMode, SavedAdventureState } from '@/lib/aigm/campaign-storage'

const CLOUD_REVISION_PREFIX = 'rpgyw-cloud-revision:v1:'

export type CloudCampaignSummary = AdventureSummary & {
  campaign_mode: CampaignMode
  cloud_revision: number
  storage_source: 'cloud'
}

type CloudCampaignResponse = {
  state?: SavedAdventureState
  revision?: number
  campaign_mode?: CampaignMode
  error?: string
  code?: string
  current_revision?: number
}

export class CloudCampaignSaveError extends Error {
  code: string
  currentRevision: number | null
  constructor(message: string, code = 'cloud_save_failed', currentRevision: number | null = null) {
    super(message)
    this.name = 'CloudCampaignSaveError'
    this.code = code
    this.currentRevision = currentRevision
  }
}

function revisionKey(adventureId: string) {
  return `${CLOUD_REVISION_PREFIX}${adventureId}`
}

export function storedCloudRevision(storage: Storage, adventureId: string) {
  const value = Number(storage.getItem(revisionKey(adventureId)) || 0)
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

export function forgetCloudRevision(storage: Storage, adventureId: string) {
  storage.removeItem(revisionKey(adventureId))
}

function rememberCloudRevision(storage: Storage, adventureId: string, revision: number) {
  storage.setItem(revisionKey(adventureId), String(Math.max(1, Math.floor(revision))))
}

export async function listCloudCampaigns(storage?: Storage): Promise<CloudCampaignSummary[]> {
  const response = await fetch('/api/campaigns', { cache: 'no-store' })
  const payload = await response.json().catch(() => ({})) as { campaigns?: Array<Omit<CloudCampaignSummary, 'storage_source'>>; error?: string; code?: string }
  if (response.status === 401) return []
  if (!response.ok) throw new CloudCampaignSaveError(payload.error || 'RPG Your Way could not load your cloud campaigns.', payload.code || 'cloud_campaign_load_failed')
  const campaigns = (payload.campaigns ?? []).map((campaign) => ({ ...campaign, storage_source: 'cloud' as const }))
  if (storage) campaigns.forEach((campaign) => rememberCloudRevision(storage, campaign.adventure_id, campaign.cloud_revision))
  return campaigns
}

export async function loadCloudCampaignState(storage: Storage, adventureId: string): Promise<{
  status: 'found' | 'missing' | 'unavailable'
  state: SavedAdventureState | null
  revision: number
}> {
  try {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(adventureId)}`, { cache: 'no-store' })
    const payload = await response.json().catch(() => ({})) as CloudCampaignResponse
    if (response.status === 404) return { status: 'missing', state: null, revision: 0 }
    if (!response.ok) return { status: 'unavailable', state: null, revision: storedCloudRevision(storage, adventureId) }
    if (!payload.state || !Number.isFinite(payload.revision)) return { status: 'unavailable', state: null, revision: storedCloudRevision(storage, adventureId) }
    const revision = Math.max(1, Math.floor(payload.revision!))
    rememberCloudRevision(storage, adventureId, revision)
    return { status: 'found', state: payload.state, revision }
  } catch {
    return { status: 'unavailable', state: null, revision: storedCloudRevision(storage, adventureId) }
  }
}

export async function saveCloudCampaignState(storage: Storage, state: SavedAdventureState) {
  const expectedRevision = storedCloudRevision(storage, state.adventure_id)
  const response = await fetch(`/api/campaigns/${encodeURIComponent(state.adventure_id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      expected_revision: expectedRevision,
      campaign_mode: state.campaign_mode ?? 'solo',
      state,
    }),
  })
  const payload = await response.json().catch(() => ({})) as CloudCampaignResponse
  if (!response.ok || !Number.isFinite(payload.revision)) {
    throw new CloudCampaignSaveError(
      payload.error || 'RPG Your Way could not confirm the cloud save.',
      payload.code || 'cloud_save_failed',
      Number.isFinite(payload.current_revision) ? Math.floor(payload.current_revision!) : null,
    )
  }
  const revision = Math.max(1, Math.floor(payload.revision!))
  rememberCloudRevision(storage, state.adventure_id, revision)
  return revision
}
