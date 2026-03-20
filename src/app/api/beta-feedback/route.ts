import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

const db = () => getAdminClient().from('beta_feedback') as any

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const sort = sp.get('sort') || '-created_date'
    const limit = Math.min(Number(sp.get('limit') || 1000), 2000)
    const descending = sort.startsWith('-')
    const field = descending ? sort.slice(1) : sort

    const { data, error } = await db().select('*').order(field, { ascending: !descending }).limit(limit)
    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('[API /beta-feedback GET]', error.message)
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
    console.error('[API /beta-feedback POST]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
