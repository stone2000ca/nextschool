import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

const db = () => getAdminClient().from('visitor_logs') as any

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { data, error } = await db().insert(body).select().single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    console.error('[API /visitor-logs POST]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
