import { adminClaims } from '@/lib/functions/adminClaims'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await (getAdminClient()
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single() as any)

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await adminClaims()
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Admin claims fetch failed:', error)
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message }, { status })
  }
}
