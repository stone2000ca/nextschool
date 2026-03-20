import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createVisitRecord, listVisitRecords } from '@/lib/functions/visitRecords'

/**
 * POST /api/visit — create a visit record
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const record = await createVisitRecord({ ...body, user_id: user.id })
    return NextResponse.json(record)
  } catch (error: any) {
    console.error('[API /visit POST]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * GET /api/visit?schoolId=x — list visit records for a school (user-scoped)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const schoolId = req.nextUrl.searchParams.get('schoolId')
    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId query param is required' }, { status: 400 })
    }

    const records = await listVisitRecords({ user_id: user.id, school_id: schoolId })
    return NextResponse.json(records)
  } catch (error: any) {
    console.error('[API /visit GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
