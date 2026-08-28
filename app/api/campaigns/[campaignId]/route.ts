import { cloudCampaignErrorResponse, loadCloudCampaign, requireCloudCampaignUser, saveCloudCampaign } from '@/lib/cloud-campaigns/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SaveBody = {
  state?: unknown
  expected_revision?: unknown
  campaign_mode?: unknown
}

export async function GET(_request: Request, context: { params: Promise<{ campaignId: string }> }) {
  try {
    const user = await requireCloudCampaignUser()
    const { campaignId } = await context.params
    const campaign = await loadCloudCampaign(user.id, campaignId)
    return Response.json(campaign, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return cloudCampaignErrorResponse(error)
  }
}

export async function PUT(request: Request, context: { params: Promise<{ campaignId: string }> }) {
  try {
    const user = await requireCloudCampaignUser()
    const { campaignId } = await context.params
    const body = await request.json().catch(() => ({})) as SaveBody
    const expectedRevision = typeof body.expected_revision === 'number' ? body.expected_revision : Number(body.expected_revision ?? 0)
    const result = await saveCloudCampaign(user, campaignId, {
      state: body.state,
      expectedRevision,
      mode: body.campaign_mode,
    })
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return cloudCampaignErrorResponse(error)
  }
}
