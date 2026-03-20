import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { School } from '@/lib/entities-server'

/**
 * GET /api/schools/[id] — get a single school by ID (public)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const school = await School.get(id)
    if (!school) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(school)
  } catch (error: any) {
    console.error('GET /api/schools/[id] failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * PATCH /api/schools/[id] — update school fields (auth required)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const updated = await School.update(id, body)
    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('PATCH /api/schools/[id] failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
