import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

const db = () => getAdminClient().from('email_logs') as any

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    let query = db().select('*')
    if (sp.get('is_test') !== null && sp.get('is_test') !== undefined) {
      query = query.eq('is_test', sp.get('is_test') === 'true')
    }

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('[API /email-logs GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { data, error } = await db().insert(body).select().single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    console.error('[API /email-logs POST]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
