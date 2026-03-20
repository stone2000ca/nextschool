import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

const db = () => getAdminClient().from('school_admins') as any

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sp = req.nextUrl.searchParams
    let query = db().select('*')

    if (sp.get('school_id')) query = query.eq('school_id', sp.get('school_id'))
    if (sp.get('user_id')) query = query.eq('user_id', sp.get('user_id'))
    if (sp.get('role')) query = query.eq('role', sp.get('role'))
    if (sp.get('is_active') !== null && sp.get('is_active') !== undefined) {
      query = query.eq('is_active', sp.get('is_active') === 'true')
    }

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('[API /school-admins GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { data, error } = await db().insert(body).select().single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    console.error('[API /school-admins POST]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
