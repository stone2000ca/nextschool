import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const db = () => getAdminClient().from('photo_candidates') as any

// PATCH /api/school-photos/[id] — approve or reject a photo candidate
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const row = { ...body, updated_at: new Date().toISOString() }
    const { data, error } = await db().update(row).eq('id', id).select().single()
    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[API /school-photos/[id] PATCH]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
