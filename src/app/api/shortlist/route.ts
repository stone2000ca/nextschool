import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

// Helper to get untyped table reference (no generated Supabase types in this project)
const db = (table: string) => getAdminClient().from(table) as any

// GET /api/shortlist?conversation_id=X — list shortlisted schools scoped to conversation
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversationId = req.nextUrl.searchParams.get('conversation_id')
    if (!conversationId) {
      return NextResponse.json({ error: 'conversation_id is required' }, { status: 400 })
    }

    // Query chat_shortlists directly by conversation_id (no journey derivation needed)
    const { data: records, error: slError } = await db('chat_shortlists')
      .select('*')
      .eq('conversation_id', conversationId)
    if (slError) throw slError

    if (!records || records.length === 0) {
      return NextResponse.json({ schools: [] })
    }

    // Fetch school details for all shortlisted school IDs
    const schoolIds = records.map((r: any) => r.school_id).filter(Boolean)
    const { data: schools, error: schoolError } = await db('schools')
      .select('*')
      .in('id', schoolIds)
    if (schoolError) throw schoolError

    return NextResponse.json({ schools: schools || [] })
  } catch (error: any) {
    console.error('GET /api/shortlist failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/shortlist — add school to shortlist (multi-entity write)
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      journey_id,
      school_id,
      school_name,
      conversation_id,
      current_phase,
      phase_history,
    } = await req.json()

    if (!conversation_id || !school_id) {
      return NextResponse.json({ error: 'conversation_id and school_id are required' }, { status: 400 })
    }

    const now = new Date().toISOString()

    // 1. Create ChatShortlist record (scoped to conversation)
    const { error: csError } = await db('chat_shortlists')
      .insert({
        family_journey_id: journey_id || null,
        conversation_id,
        school_id,
        added_at: now,
        source: 'manual',
        updated_at: now,
      })
    if (csError) throw csError

    // 2-3. Journey side effects (only when journey_id is available)
    if (journey_id) {
      // 2. Create SchoolJourney record (E29-004)
      const { error: sjError } = await db('school_journeys')
        .insert({
          family_journey_id: journey_id,
          school_id,
          school_name: school_name || '',
          status: 'shortlisted',
          added_at: now,
          updated_at: now,
        })
      if (sjError) {
        console.error('[E29-004] SchoolJourney create failed:', sjError.message)
      }

      // 3. Phase auto-advancement MATCH → EVALUATE (E29-015)
      if (current_phase === 'MATCH') {
        const newHistory = Array.isArray(phase_history) ? phase_history : []
        const { error: fjError } = await db('family_journeys')
          .update({
            current_phase: 'EVALUATE',
            phase_history: [...newHistory, { phase: 'EVALUATE', enteredAt: now }],
            updated_at: now,
          })
          .eq('id', journey_id)
        if (fjError) {
          console.error('[E29-015] Phase advance MATCH→EVALUATE failed:', fjError.message)
        } else {
          console.log('[E29-015] FamilyJourney advanced MATCH → EVALUATE')
        }
      }
    }

    // 4. Atomically update ChatSession.shortlisted_count (E48-S4)
    // Count by conversation_id for accurate per-conversation count
    let shortlisted_count: number | null = null
    const { count, error: countError } = await db('chat_shortlists')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversation_id)
    if (!countError && count != null) {
      shortlisted_count = count
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

    return NextResponse.json({ success: true, shortlisted_count })
  } catch (error: any) {
    console.error('POST /api/shortlist failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
