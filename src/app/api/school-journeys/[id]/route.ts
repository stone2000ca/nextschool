import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

const db = () => getAdminClient().from('school_journeys') as any

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
    const { data, error } = await db().update(body).eq('id', id).select().single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[API /school-journeys PATCH]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
