import { createClient } from '@/lib/supabase/server'
import { listEventReminders, toggleEventReminder, cleanExpiredReminders } from '@/lib/functions/eventReminders'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/event-reminders — list current user's reminders
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const reminders = await listEventReminders({ user_id: user.id })
    return NextResponse.json(reminders)
  } catch (error: any) {
    console.error('[API /event-reminders GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/event-reminders — toggle a reminder (add or remove)
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    if (!body.event_id) {
      return NextResponse.json({ error: 'event_id is required' }, { status: 400 })
    }

    const result = await toggleEventReminder({
      user_id: user.id,
      event_id: body.event_id,
      school_name: body.school_name,
      event_title: body.event_title,
      event_date: body.event_date,
    })
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[API /event-reminders POST]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/event-reminders — clean expired reminders for current user
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await cleanExpiredReminders({ user_id: user.id })
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[API /event-reminders DELETE]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
