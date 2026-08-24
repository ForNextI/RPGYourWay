import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  const destination = request.nextUrl.clone()
  destination.pathname = '/account'
  destination.search = ''

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })

    if (!error) {
      destination.searchParams.set('status', 'confirmed')
      return NextResponse.redirect(destination)
    }
  }

  destination.searchParams.set('error', 'confirmation')
  return NextResponse.redirect(destination)
}
