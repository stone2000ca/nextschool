import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const db = () => getAdminClient().from('user_profiles') as any

// GET /api/admin-users — list all users (admin only)
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin role (admin role lives in public.users, not user_profiles)
    const { data: profile } = await (getAdminClient().from('users').select('role').eq('id', user.id).single() as any)
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sort = req.nextUrl.searchParams.get('sort') || '-created_at'
    const descending = sort.startsWith('-')
    const field = descending ? sort.slice(1) : sort

    const { data, error } = await db().select('*').order(field, { ascending: !descending })
    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('[API /admin-users GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH /api/admin-users — update a user (e.g. token balance)
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { id, ...updates } = body
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Users can only update their own profile (unless admin)
    if (id !== user.id) {
      const { data: profile } = await (getAdminClient().from('users').select('role').eq('id', user.id).single() as any)
      if (!profile || profile.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const row = { ...updates, updated_at: new Date().toISOString() }
    const { data, error } = await db().update(row).eq('id', id).select().single()
    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[API /admin-users PATCH]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
