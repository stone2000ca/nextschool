import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const db = (table: string) => getAdminClient().from(table) as any

// GET /api/family-journey?user_id=X&is_archived=false&chat_history_id=Y
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = req.nextUrl.searchParams
    const userId = params.get('user_id')
    if (!userId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    // Security: users can only query their own journeys
    if (userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let query = db('family_journeys').select('*').eq('user_id', userId)

    const isArchived = params.get('is_archived')
    if (isArchived !== null) {
      query = query.eq('is_archived', isArchived === 'true')
    }

    const chatHistoryId = params.get('chat_history_id')
    if (chatHistoryId) {
      query = query.eq('chat_history_id', chatHistoryId)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('[API /family-journey GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/family-journey — create a new family journey
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    if (!body.user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    // Security: users can only create journeys for themselves
    if (body.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const row = { ...body, updated_at: new Date().toISOString() }
    const { data, error } = await db('family_journeys').insert(row).select().single()
    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    console.error('[API /family-journey POST]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH /api/family-journey — update a family journey (requires id in body)
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

    const row = { ...updates, updated_at: new Date().toISOString() }
    const { data, error } = await db('family_journeys').update(row).eq('id', id).select().single()
    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[API /family-journey PATCH]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
