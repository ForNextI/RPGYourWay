import { foundryCorsHeaders, foundryErrorResponse, requireFoundrySession } from '@/lib/foundry/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: foundryCorsHeaders() })
}

export async function GET(request: Request) {
  try {
    const { connection, campaign } = await requireFoundrySession(request)
    return Response.json({
      connected: true,
      connectionId: connection.id,
      campaignId: campaign.id,
      campaignName: campaign.name,
      campaignMode: campaign.mode,
      campaignRevision: Number(campaign.revision) || 1,
      campaignUpdatedAt: campaign.updated_at,
      worldId: connection.integrator_world_id,
      worldLabel: connection.foundry_world_label || 'Foundry world',
      foundryControllerUserId: connection.controller_foundry_user_id,
      foundryControllerName: connection.controller_foundry_user_name || 'Foundry GM',
    }, { headers: foundryCorsHeaders() })
  } catch (error) {
    return foundryErrorResponse(error, true)
  }
}
