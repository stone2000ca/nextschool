import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

function keysToCamel(obj: Record<string, any>): Record<string, any> {
  if (obj === null || obj === undefined) return obj
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    result[snakeToCamel(key)] = value
  }
  return result
}

// Map frontend/camelCase field names to actual DB column names
const COLUMN_ALIASES: Record<string, string> = {
    updatedAt: 'updated_date',
    createdAt: 'created_date',
    updated_at: 'updated_date',
    created_at: 'created_date',
}

async function listSchools(params: { status?: string; sort?: string; limit?: number }) {
  const { status, sort, limit } = params
  const supabase = getAdminClient()

  let query = supabase.from('schools').select('*')

  if (status) {
    query = query.eq('status', status)
  }

  if (sort) {
    const descending = sort.startsWith('-')
    const rawField = descending ? sort.slice(1) : sort
    const field = COLUMN_ALIASES[rawField] || rawField
    query = query.order(field, { ascending: !descending })
  }

  if (limit) {
    query = query.limit(limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('[list-schools] Supabase error:', error)
    throw new Error(error.message)
  }

  console.log(`[list-schools] Returned ${(data || []).length} schools (status=${status}, sort=${sort}, limit=${limit})`)

  return (data || []).map(keysToCamel)
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
