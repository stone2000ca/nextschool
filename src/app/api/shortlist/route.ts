import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

// Helper to get untyped table reference (no generated Supabase types in this project)
const db = (table: string) => getAdminClient().from(table) as any

// GET /api/shortlist?journey_id=X — list shortlisted schools with school details joined
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const journeyId = req.nextUrl.searchParams.get('journey_id')
    if (!journeyId) {
      return NextResponse.json({ error: 'journey_id is required' }, { status: 400 })
    }

    // Fetch shortlist records
    const { data: records, error: slError } = await db('chat_shortlists')
      .select('*')
      .eq('family_journey_id', journeyId)
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

    if (!journey_id || !school_id) {
      return NextResponse.json({ error: 'journey_id and school_id are required' }, { status: 400 })
    }

    const now = new Date().toISOString()

    // 1. Create ChatShortlist record
    const { error: csError } = await db('chat_shortlists')
      .insert({
        family_journey_id: journey_id,
        school_id,
        addedAt: now,
        source: 'manual',
        updated_at: now,
      })
    if (csError) throw csError

    // 2. Create SchoolJourney record (E29-004)
    const { error: sjError } = await db('school_journeys')
      .insert({
        family_journey_id: journey_id,
        school_id,
        school_name: school_name || '',
        status: 'shortlisted',
        addedAt: now,
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

    // 4. Update ChatSession.shortlisted_count (E48-S4)
    let shortlisted_count: number | null = null
    if (conversation_id) {
      const { data: sessions, error: sessError } = await db('chat_sessions')
        .select('id, shortlisted_count')
        .eq('chat_history_id', conversation_id)
        .limit(1)
      if (!sessError && sessions && sessions.length > 0) {
        const session = sessions[0]
        const newCount = (session.shortlisted_count || 0) + 1
        await db('chat_sessions')
          .update({ shortlisted_count: newCount, updated_at: now })
          .eq('id', session.id)
        shortlisted_count = newCount
      }
    }

    return NextResponse.json({ success: true, shortlisted_count })
  } catch (error: any) {
    console.error('POST /api/shortlist failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
