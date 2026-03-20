import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SchoolClaim } from '@/lib/entities-server'

/**
 * PATCH /api/school-claims/[id] — update a claim (auth required)
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
    const updated = await SchoolClaim.update(id, body)
    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('PATCH /api/school-claims/[id] failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
