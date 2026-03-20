import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const db = () => getAdminClient().from('school_journeys') as any

// GET /api/school-journeys?family_journey_id=X
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const familyJourneyId = req.nextUrl.searchParams.get('family_journey_id')
    if (!familyJourneyId) {
      return NextResponse.json({ error: 'family_journey_id is required' }, { status: 400 })
    }

    const { data, error } = await db().select('*').eq('family_journey_id', familyJourneyId)
    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('[API /school-journeys GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
