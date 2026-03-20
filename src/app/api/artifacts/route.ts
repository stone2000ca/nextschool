import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const db = () => getAdminClient().from('generated_artifacts') as any

// GET /api/artifacts?conversation_id=X
export async function GET(req: NextRequest) {
  try {
    const conversationId = req.nextUrl.searchParams.get('conversation_id')
    if (!conversationId) {
      return NextResponse.json({ error: 'conversation_id is required' }, { status: 400 })
    }

    const { data, error } = await db().select('*').eq('conversation_id', conversationId)
    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('[API /artifacts GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/artifacts — create a generated artifact
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { data, error } = await db().insert(body).select().single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    console.error('[API /artifacts POST]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
