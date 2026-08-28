import { cloudCampaignErrorResponse, listCloudCampaigns, requireCloudCampaignUser } from '@/lib/cloud-campaigns/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireCloudCampaignUser()
    const campaigns = await listCloudCampaigns(user.id)
    return Response.json({ campaigns }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return cloudCampaignErrorResponse(error)
  }
}
