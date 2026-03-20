import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SchoolInquiry } from '@/lib/entities-server'

/**
 * GET /api/school-inquiries — list/filter inquiries (auth required)
 *
 * Query params:
 *   school_id     — exact school_id match
 *   inquiry_type  — exact type match (e.g. 'tour_request')
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

    if (sp.get('school_id')) filter.school_id = sp.get('school_id')
    if (sp.get('inquiry_type')) filter.inquiry_type = sp.get('inquiry_type')

    const inquiries = await SchoolInquiry.filter(filter)
    return NextResponse.json(inquiries)
  } catch (error: any) {
    console.error('GET /api/school-inquiries failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/school-inquiries — create a new inquiry (auth required)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const created = await SchoolInquiry.create(body)
    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/school-inquiries failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
