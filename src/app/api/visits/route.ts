import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listAllVisitRecords, checkAndTransitionVisits } from '@/lib/functions/visitRecords'

/**
 * GET /api/visits — list all visit records for the current user (cross-school)
 * Also runs auto-transition for past-date upcoming visits.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Auto-transition any upcoming visits that are now past-date
    await checkAndTransitionVisits({ user_id: user.id })

    const records = await listAllVisitRecords({ user_id: user.id })
    return NextResponse.json(records)
  } catch (error: any) {
    console.error('[API /visits GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
