import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ChatHistory } from '@/lib/entities-server'
import type { UpdateConversationInput } from '@/lib/api/types'

/**
 * GET /api/conversations/[id] — get a single conversation by ID
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversation = await ChatHistory.get(id)
    if (!conversation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (conversation.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(conversation)
  } catch (error: any) {
    console.error('GET /api/conversations/[id] failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * PATCH /api/conversations/[id] — update conversation (star, archive, context, etc.)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const existing = await ChatHistory.get(id)
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body: UpdateConversationInput = await req.json()
    const updated = await ChatHistory.update(id, body)
    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('PATCH /api/conversations/[id] failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * DELETE /api/conversations/[id] — soft-delete (set is_active=false)
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const existing = await ChatHistory.get(id)
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await ChatHistory.update(id, { is_active: false })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('DELETE /api/conversations/[id] failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
