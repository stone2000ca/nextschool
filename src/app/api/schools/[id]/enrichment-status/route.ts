import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { School } from '@/lib/entities-server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: schoolId } = await params

    const school = await School.get(schoolId)
    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 })
    }

    return NextResponse.json({
      schoolId: school.id,
      enrichmentStatus: school.enrichment_status || null,
    })
  } catch (error: any) {
    console.error('[API /schools/[id]/enrichment-status GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
