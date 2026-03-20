import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const db = () => getAdminClient().from('school_analyses') as any

// GET /api/school-analyses?user_id=X&conversation_id=Y
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
    console.error('[API /school-analyses GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
