import { cloudCampaignErrorResponse, requireCloudCampaignUser } from '@/lib/cloud-campaigns/server'
import { actOnCampaignGovernance, loadCampaignGovernance } from '@/lib/cloud-campaigns/governance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, context: { params: Promise<{ campaignId: string }> }) {
  try {
    const user = await requireCloudCampaignUser()
    const { campaignId } = await context.params
    const governance = await loadCampaignGovernance(user, campaignId)
    return Response.json(governance, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return cloudCampaignErrorResponse(error)
  }
}

export async function POST(request: Request, context: { params: Promise<{ campaignId: string }> }) {
  try {
    const user = await requireCloudCampaignUser()
    const { campaignId } = await context.params
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const result = await actOnCampaignGovernance(user, campaignId, body)
    return Response.json({ result }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return cloudCampaignErrorResponse(error)
  }
}
