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
