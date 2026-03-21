import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { ChatSession } from '@/lib/entities-server'
import type { CreateSessionInput } from '@/lib/api/types'

/**
 * GET /api/sessions — list sessions for authenticated user
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessions = await ChatSession.filter({ user_id: user.id })
    return NextResponse.json(sessions)
  } catch (error: any) {
    console.error('GET /api/sessions failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/sessions — create a new session
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Defensive guard: ensure user exists in public.users to satisfy FK constraint.
    // The signup trigger should create this row, but some edge cases miss it.
    const admin = getAdminClient()
    await admin.from('users').upsert(
      { id: user.id, email: user.email ?? '', role: 'user' },
      { onConflict: 'id', ignoreDuplicates: true }
    )

    const body: CreateSessionInput = await req.json()

    // Enforce user_id from auth
    const created = await ChatSession.create({
      ...body,
      user_id: user.id,
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/sessions failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
