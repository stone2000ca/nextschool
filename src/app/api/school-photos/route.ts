import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const db = () => getAdminClient().from('photo_candidates') as any

// GET /api/school-photos?school_id=X
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const schoolId = req.nextUrl.searchParams.get('school_id')
    if (!schoolId) {
      return NextResponse.json({ error: 'school_id is required' }, { status: 400 })
    }

    const { data, error } = await db().select('*').eq('school_id', schoolId)
    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('[API /school-photos GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
