import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SchoolClaim } from '@/lib/entities-server'

/**
 * GET /api/school-claims — list/filter claims (auth required)
 *
 * Query params:
 *   status       — exact status match
 *   school_id    — exact school_id match
 *   user_id      — exact user_id match
 *   claimed_by   — exact claimed_by match
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sp = req.nextUrl.searchParams
    const filter: Record<string, any> = {}

    if (sp.get('status')) filter.status = sp.get('status')
    if (sp.get('school_id')) filter.school_id = sp.get('school_id')
    if (sp.get('user_id')) filter.user_id = sp.get('user_id')
    if (sp.get('claimed_by')) filter.claimed_by = sp.get('claimed_by')

    const claims = await SchoolClaim.filter(filter)
    return NextResponse.json(claims)
  } catch (error: any) {
    console.error('GET /api/school-claims failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/school-claims — create a new claim (auth required)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const created = await SchoolClaim.create(body)
    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/school-claims failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
