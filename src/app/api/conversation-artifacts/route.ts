import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

const db = () => getAdminClient().from('conversation_artifacts') as any

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sp = req.nextUrl.searchParams
    let query = db().select('*')
    if (sp.get('conversation_id')) query = query.eq('conversation_id', sp.get('conversation_id'))
    if (sp.get('school_id')) query = query.eq('school_id', sp.get('school_id'))

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('[API /conversation-artifacts GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
