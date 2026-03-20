import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateVisitRecord } from '@/lib/functions/visitRecords'

/**
 * PATCH /api/visit/[id] — update a visit record
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const record = await updateVisitRecord({ ...body, id, user_id: user.id })
    return NextResponse.json(record)
  } catch (error: any) {
    console.error('[API /visit PATCH]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
