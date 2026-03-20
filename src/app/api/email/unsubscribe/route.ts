import { processUnsubscribe } from '@/lib/functions/emailPreferences'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/email/unsubscribe — process tokenized unsubscribe (no auth required)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.token || typeof body.token !== 'string') {
      return NextResponse.json({ error: 'token is required' }, { status: 400 })
    }

    const result = await processUnsubscribe({ token: body.token })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API /email/unsubscribe POST]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
