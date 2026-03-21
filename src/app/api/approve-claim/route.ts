import { approveClaim } from '@/lib/functions/approveClaim'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    // Verify the caller is an authenticated admin
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

    const params = await req.json()
    const result = await approveClaim(params)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Approve claim failed:', error)
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message }, { status })
  }
}
