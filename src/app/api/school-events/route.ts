import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const db = () => getAdminClient().from('school_events') as any

// GET /api/school-events?school_id=X&is_active=true&source=ai_enriched
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    const schoolId = params.get('school_id')
    if (!schoolId) {
      return NextResponse.json({ error: 'school_id is required' }, { status: 400 })
    }

    let query = db().select('*').eq('school_id', schoolId)

    const isActive = params.get('is_active')
    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true')
    }

    const source = params.get('source')
    if (source) {
      query = query.eq('source', source)
    }

    const dateGte = params.get('date_gte')
    if (dateGte) {
      query = query.gte('date', dateGte)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('[API /school-events GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/school-events — create a new event (requires auth + school admin)
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    if (!body.school_id || !body.title || !body.event_type || !body.date) {
      return NextResponse.json({ error: 'school_id, title, event_type, and date are required' }, { status: 400 })
    }

    const row = { ...body, updated_at: new Date().toISOString() }
    const { data, error } = await db().insert(row).select().single()
    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    console.error('[API /school-events POST]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
