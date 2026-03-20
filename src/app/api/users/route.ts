import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

const db = () => getAdminClient().from('user_profiles') as any

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sp = req.nextUrl.searchParams
    let query = db().select('*')
    if (sp.get('id')) query = query.eq('id', sp.get('id'))
    if (sp.get('email')) query = query.eq('email', sp.get('email'))

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('[API /users GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
