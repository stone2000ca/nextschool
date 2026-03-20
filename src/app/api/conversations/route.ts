import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ChatHistory } from '@/lib/entities-server'
import type { CreateConversationInput } from '@/lib/api/types'

/**
 * GET /api/conversations — list active conversations for authenticated user
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversations = await ChatHistory.filter(
      { user_id: user.id, is_active: true },
      '-updated_at'
    )
    return NextResponse.json(conversations)
  } catch (error: any) {
    console.error('GET /api/conversations failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/conversations — create a new conversation
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: CreateConversationInput = await req.json()

    // Enforce user_id from auth — never trust client-supplied user_id
    const created = await ChatHistory.create({
      ...body,
      user_id: user.id,
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/conversations failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
