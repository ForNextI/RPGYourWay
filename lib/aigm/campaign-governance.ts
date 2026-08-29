import type { CampaignAdministrationMode, CampaignMode } from '@/lib/aigm/campaign-storage'

export type CampaignGovernanceMember = {
  user_id: string
  display_name: string
  is_self: boolean
  is_coordinator: boolean
  joined_at: string
}

export type CampaignDecision = {
  id: string
  type: 'remove_member' | 'delete_campaign'
  target_user_id: string | null
  target_display_name: string | null
  proposed_by_display_name: string
  approvals: number
  oppositions: number
  required: number
  my_vote: 'approve' | 'oppose' | null
  can_vote: boolean
  created_at: string
}

export type CampaignGovernanceView = {
  campaign_id: string
  campaign_name: string
  campaign_mode: CampaignMode
  administration_mode: CampaignAdministrationMode
  is_coordinator: boolean
  can_leave: boolean
  can_delete_directly: boolean
  members: CampaignGovernanceMember[]
  decisions: CampaignDecision[]
}

type GovernancePayload = CampaignGovernanceView & { error?: string }

async function governanceResponse(response: Response) {
  const payload = await response.json().catch(() => ({})) as GovernancePayload
  if (!response.ok) throw new Error(payload.error || 'RPG Your Way could not update those campaign controls.')
  return payload
}

export async function loadCampaignGovernance(campaignId: string) {
  return governanceResponse(await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/governance`, { cache: 'no-store' }))
}

export async function campaignGovernanceAction(campaignId: string, action: Record<string, unknown>) {
  const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/governance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
  })
  const payload = await response.json().catch(() => ({})) as { error?: string; result?: Record<string, unknown> }
  if (!response.ok) throw new Error(payload.error || 'RPG Your Way could not update those campaign controls.')
  return payload.result ?? {}
}
