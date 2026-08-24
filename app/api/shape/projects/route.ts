import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function authenticatedClient() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return { error: Response.json({ error: 'Sign in before using Shape.' }, { status: 401 }) }
  return { supabase, user: data.user }
}

export async function GET() {
  const auth = await authenticatedClient()
  if ('error' in auth) return auth.error

  const { data, error } = await auth.supabase
    .from('shape_projects')
    .select('id,title,completed_parts,created_at,updated_at')
    .eq('user_id', auth.user.id)
    .order('updated_at', { ascending: false })
    .limit(24)

  if (error) return Response.json({ error: 'Shape could not read your campaign projects. Apply the Shape beta instrumentation migration first.' }, { status: 503 })
  return Response.json({ projects: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticatedClient()
  if ('error' in auth) return auth.error
  const id = request.nextUrl.searchParams.get('id')?.trim() || ''
  if (!id) return Response.json({ error: 'Choose a Shape project to clear.' }, { status: 400 })

  const { error } = await auth.supabase
    .from('shape_projects')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.user.id)

  if (error) return Response.json({ error: 'Shape could not clear that project.' }, { status: 500 })
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
