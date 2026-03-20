import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

const db = () => getAdminClient().from('conversation_state') as any

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversationId = req.nextUrl.searchParams.get('conversation_id')
    if (!conversationId) {
      return NextResponse.json({ error: 'conversation_id is required' }, { status: 400 })
    }

    const { data, error } = await db().select('*').eq('conversation_id', conversationId)
    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('[API /conversation-state GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
