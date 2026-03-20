import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const db = (table: string) => getAdminClient().from(table) as any

// GET /api/shortlist-counts?journey_ids=id1,id2,id3
// Returns { counts: { [journey_id]: number } } from chat_shortlists table
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const journeyIdsParam = req.nextUrl.searchParams.get('journey_ids')
    if (!journeyIdsParam) {
      return NextResponse.json({ counts: {} })
    }

    const journeyIds = journeyIdsParam.split(',').filter(Boolean)
    if (journeyIds.length === 0) {
      return NextResponse.json({ counts: {} })
    }

    // Fetch all chat_shortlists for the given journey IDs
    const { data: records, error } = await db('chat_shortlists')
      .select('family_journey_id')
      .in('family_journey_id', journeyIds)
    if (error) throw error

    // Count per journey_id
    const counts: Record<string, number> = {}
    for (const rec of (records || [])) {
      const jid = rec.family_journey_id
      counts[jid] = (counts[jid] || 0) + 1
    }

    return NextResponse.json({ counts })
  } catch (error: any) {
    console.error('GET /api/shortlist-counts failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
