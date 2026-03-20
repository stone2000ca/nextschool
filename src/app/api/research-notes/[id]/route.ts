import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

const db = () => getAdminClient().from('notes') as any

/**
 * PATCH /api/research-notes/[id] — update a research note
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
    const { data, error } = await db()
      .update(body)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[API /research-notes PATCH]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * DELETE /api/research-notes/[id] — delete a research note
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { error } = await db().delete().eq('id', id).eq('user_id', user.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API /research-notes DELETE]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
