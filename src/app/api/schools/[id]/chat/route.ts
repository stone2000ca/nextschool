import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { schoolAdminChat } from '@/lib/functions/schoolAdminChat'

export const maxDuration = 60

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()

    const result = await schoolAdminChat(id, {
      message: body.message,
      conversationHistory: body.conversationHistory,
      context: body.context,
    })

    return NextResponse.json({ data: result })
  } catch (error: any) {
    console.error('[school-chat] Error:', error.message)
    const status = error.status || 500
    return NextResponse.json({ error: error.message }, { status })
  }
}
