import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

const db = () => getAdminClient().from('llm_logs') as any

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const conversationId = sp.get('conversation_id')
    const sort = sp.get('sort') || '-created_date'
    const limit = Math.min(Number(sp.get('limit') || 100), 500)
    const descending = sort.startsWith('-')
    const field = descending ? sort.slice(1) : sort

    let query = db().select('*')
    if (conversationId) query = query.eq('conversation_id', conversationId)

    const { data, error } = await query.order(field, { ascending: !descending }).limit(limit)
    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('[API /llm-logs GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
