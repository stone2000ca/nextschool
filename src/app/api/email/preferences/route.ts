import { createClient } from '@/lib/supabase/server'
import { getEmailPreferences, updateEmailPreferences } from '@/lib/functions/emailPreferences'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/email/preferences — get current user's email preferences
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const prefs = await getEmailPreferences({ user_id: user.id })
    return NextResponse.json(prefs)
  } catch (error: any) {
    console.error('[API /email/preferences GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/email/preferences — update current user's email preferences
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    if (typeof body.email_notifications_enabled !== 'boolean') {
      return NextResponse.json({ error: 'email_notifications_enabled (boolean) is required' }, { status: 400 })
    }

    const result = await updateEmailPreferences({
      user_id: user.id,
      email_notifications_enabled: body.email_notifications_enabled,
    })
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[API /email/preferences POST]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
