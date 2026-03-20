import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/admin-analytics — returns users + token transactions (admin only)
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = getAdminClient()
    const { data: profile } = await (admin.from('user_profiles') as any)
      .select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [usersResult, txResult] = await Promise.all([
      (admin.from('user_profiles') as any).select('*').order('created_date', { ascending: false }),
      (admin.from('token_transactions') as any).select('*').order('created_date', { ascending: false }).limit(1000),
    ])

    if (usersResult.error) throw usersResult.error
    if (txResult.error) throw txResult.error

    return NextResponse.json({
      users: usersResult.data || [],
      tokenTransactions: txResult.data || [],
    })
  } catch (error: any) {
    console.error('[API /admin-analytics GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
