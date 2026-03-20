import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

const db = () => getAdminClient().from('notes') as any

/**
 * GET /api/research-notes — list research notes for authenticated user
 * Supports ?user_id=...&school_id=... query params
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sp = req.nextUrl.searchParams
    let query = db().select('*')

    // Always scope to authenticated user
    query = query.eq('user_id', user.id)

    if (sp.get('school_id')) query = query.eq('school_id', sp.get('school_id'))

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('[API /research-notes GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/research-notes — create a research note
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { data, error } = await db()
      .insert({ ...body, user_id: user.id })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    console.error('[API /research-notes POST]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
