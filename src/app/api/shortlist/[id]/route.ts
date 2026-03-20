import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

// Helper to get untyped table reference (no generated Supabase types in this project)
const db = (table: string) => getAdminClient().from(table) as any

// DELETE /api/shortlist/[id] — remove school from shortlist
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: journeyId } = await params

    const {
      school_id,
      conversation_id,
      current_count,
    } = await req.json()

    if (!school_id) {
      return NextResponse.json({ error: 'school_id is required' }, { status: 400 })
    }

    const now = new Date().toISOString()

    // 1. Delete ChatShortlist records for this journey + school
    const { data: existing, error: findError } = await db('chat_shortlists')
      .select('id')
      .eq('family_journey_id', journeyId)
      .eq('school_id', school_id)
    if (findError) throw findError

    for (const rec of (existing || [])) {
      await db('chat_shortlists').delete().eq('id', rec.id)
    }

    // 2. Update SchoolJourney status to 'removed' (E29-004)
    const { data: sjRecords } = await db('school_journeys')
      .select('id')
      .eq('family_journey_id', journeyId)
      .eq('school_id', school_id)
      .limit(1)
    if (sjRecords && sjRecords.length > 0) {
      await db('school_journeys')
        .update({ status: 'removed', updated_at: now })
        .eq('id', sjRecords[0].id)
    }

    // 3. Atomically update ChatSession.shortlisted_count from chat_shortlists (E48-S4)
    // Count actual remaining rows instead of relying on client-provided current_count
    if (conversation_id) {
      const { count, error: countError } = await db('chat_shortlists')
        .select('id', { count: 'exact', head: true })
        .eq('family_journey_id', journeyId)
      if (!countError && count != null) {
        const { data: sessions } = await db('chat_sessions')
          .select('id')
          .eq('chat_history_id', conversation_id)
          .limit(1)
        if (sessions && sessions.length > 0) {
          await db('chat_sessions')
            .update({ shortlisted_count: count, updated_at: now })
            .eq('id', sessions[0].id)
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('DELETE /api/shortlist/[id] failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
