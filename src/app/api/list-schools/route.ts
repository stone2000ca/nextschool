import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

// Safe columns known to exist in production — used for sorting validation
const SAFE_SORT_COLUMNS = new Set([
  'id', 'name', 'slug', 'city', 'country', 'status',
])

async function listSchools(params: { status?: string; sort?: string; limit?: number }) {
  const { status, limit } = params
  const supabase = getAdminClient()

  let query = supabase.from('schools').select('*')

  if (status) {
    query = query.eq('status', status)
  }

  // Only sort by columns we know exist in production to avoid 500s.
  // Default sort by name if the requested column isn't safe.
  if (params.sort) {
    const descending = params.sort.startsWith('-')
    const rawField = descending ? params.sort.slice(1) : params.sort
    // Sort field should already be snake_case; normalize just in case
    const field = rawField.replace(/([A-Z])/g, '_$1').toLowerCase()
    if (SAFE_SORT_COLUMNS.has(field)) {
      query = query.order(field, { ascending: !descending })
    } else {
      // Fallback: sort by name ascending
      query = query.order('name', { ascending: true })
    }
  }

  if (limit) {
    query = query.limit(limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('[list-schools] Supabase error:', error)
    throw new Error(error.message)
  }

  console.log(`[list-schools] Returned ${(data || []).length} schools (status=${status}, limit=${limit})`)

  return data || []
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const status = url.searchParams.get('status') || undefined
    const sort = url.searchParams.get('sort') || undefined
    const limitParam = url.searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : undefined

    const result = await listSchools({ status, sort, limit })
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('list-schools error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await listSchools(params)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('list-schools error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
