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

// Map legacy column names to actual DB column names
const COLUMN_ALIASES: Record<string, string> = {
  updated_date: 'updated_at',
  created_date: 'created_at',
}

export async function POST(req: NextRequest) {
  try {
    const { status, sort, limit } = await req.json()
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
      console.error('list-schools error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json((data || []).map(keysToCamel))
  } catch (error: any) {
    console.error('list-schools error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
