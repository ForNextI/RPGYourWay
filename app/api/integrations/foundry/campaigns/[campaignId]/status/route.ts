import { foundryErrorResponse, requireFoundryWebUser } from '@/lib/foundry/server'
import { getFoundryCampaignStatus } from '@/lib/foundry/combat-handoff'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  context: { params: Promise<{ campaignId: string }> },
) {
  try {
    const user = await requireFoundryWebUser()
    const { campaignId } = await context.params
    const status = await getFoundryCampaignStatus(user, campaignId)
    return Response.json(status, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return foundryErrorResponse(error)
  }
}
