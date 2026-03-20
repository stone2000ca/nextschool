import { getAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/shared/shortlist/[hash] — public, no auth required
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await params

    if (!hash) {
      return NextResponse.json({ error: 'Hash is required' }, { status: 400 })
    }

    const { data: results, error } = await (getAdminClient()
      .from('shared_shortlists') as any)
      .select('*')
      .eq('hash', hash)
      .limit(1)

    if (error) throw error

    if (!results || results.length === 0) {
      return NextResponse.json({ error: 'Shortlist not found' }, { status: 404 })
    }

    return NextResponse.json({ shortlist: results[0] })
  } catch (error: any) {
    console.error('GET /api/shared/shortlist/[hash] failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
