import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { School } from '@/lib/entities-server'

/**
 * GET /api/schools — list/filter/search schools (public)
 *
 * Query params:
 *   ids          — comma-separated IDs
 *   names        — comma-separated exact names ($in)
 *   slug         — exact slug match
 *   city         — exact city match
 *   search       — fuzzy name search (ilike)
 *   admin_user_id — legacy owner lookup
 *   sort         — e.g. "-updated_date" (default)
 *   limit        — max results (default 500)
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const ids = sp.get('ids')
    const names = sp.get('names')
    const slug = sp.get('slug')
    const city = sp.get('city')
    const search = sp.get('search')
    const adminUserId = sp.get('admin_user_id')
    const sort = sp.get('sort') || '-updated_date'
    const limit = Math.min(Number(sp.get('limit') || 500), 1000)

    const filter: Record<string, any> = {}

    if (ids) {
      filter.id = { $in: ids.split(',').map(s => s.trim()).filter(Boolean) }
    }
    if (names) {
      filter.name = { $in: names.split(',').map(s => s.trim()).filter(Boolean) }
    }
    if (slug) {
      filter.slug = slug
    }
    if (city) {
      filter.city = city
    }
    if (search) {
      filter.name = { $regex: search }
    }
    if (adminUserId) {
      filter.admin_user_id = adminUserId
    }

    const schools = await School.filter(filter, sort, limit)
    return NextResponse.json(schools)
  } catch (error: any) {
    console.error('GET /api/schools failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/schools — create a new school (auth required)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const created = await School.create({
      ...body,
      user_id: user.id,
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/schools failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
