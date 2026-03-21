import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { ChatHistory } from '@/lib/entities-server'

/**
 * GET /api/admin/conversations — list all conversations (admin-only)
 */
export async function GET() {
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

    const conversations = await ChatHistory.list('-created_at')
    return NextResponse.json(conversations)
  } catch (error: any) {
    console.error('GET /api/admin/conversations failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
