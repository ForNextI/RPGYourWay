import { requireUsageAccount, billingErrorResponse } from '@/lib/usage/server-billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const account = await requireUsageAccount()
    return Response.json({
      owner_qa: account.ownerQa,
      voice_available: account.ownerQa,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return billingErrorResponse(error)
  }
}
