import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const db = () => getAdminClient().from('family_profiles') as any

// GET /api/family-profile?user_id=X&conversation_id=Y  OR  ?id=X
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = req.nextUrl.searchParams
    const id = params.get('id')

    // Single record by id
    if (id) {
      const { data, error } = await db().select('*').eq('id', id).single()
      if (error) throw error
      return NextResponse.json(data)
    }

    // Filter by user_id + optional conversation_id
    const userId = params.get('user_id')
    if (!userId) {
      return NextResponse.json({ error: 'user_id or id is required' }, { status: 400 })
    }
    if (userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let query = db().select('*').eq('user_id', userId)

    const conversationId = params.get('conversation_id')
    if (conversationId) {
      query = query.eq('conversation_id', conversationId)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('[API /family-profile GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
