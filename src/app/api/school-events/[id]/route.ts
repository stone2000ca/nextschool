import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const db = () => getAdminClient().from('school_events') as any

// GET /api/school-events/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { data, error } = await db().select('*').eq('id', id).single()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[API /school-events/[id] GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH /api/school-events/[id]
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
    console.error('[API /school-events/[id] PATCH]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/school-events/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { error } = await db().delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API /school-events/[id] DELETE]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
