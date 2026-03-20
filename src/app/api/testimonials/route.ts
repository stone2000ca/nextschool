import { NextRequest, NextResponse } from 'next/server'
import { Testimonial } from '@/lib/entities-server'

/**
 * GET /api/testimonials — list/filter testimonials (public)
 *
 * Query params:
 *   school_id   — exact school_id match
 *   is_visible  — boolean filter (default: not filtered)
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const filter: Record<string, any> = {}

    if (sp.get('school_id')) filter.school_id = sp.get('school_id')
    if (sp.get('is_visible')) filter.is_visible = sp.get('is_visible') === 'true'

    const testimonials = await Testimonial.filter(filter)
    return NextResponse.json(testimonials)
  } catch (error: any) {
    console.error('GET /api/testimonials failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/testimonials — create a testimonial (auth required)
 */
export async function POST(req: NextRequest) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const created = await Testimonial.create(body)
    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/testimonials failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
