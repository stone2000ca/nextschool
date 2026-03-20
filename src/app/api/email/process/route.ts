import { NextRequest, NextResponse } from 'next/server'
import { processEmailQueue } from '@/lib/functions/emailQueue'

/**
 * POST /api/email/process — E51-S4A
 *
 * Process due emails in the email_queue table.
 * Designed to be called by a cron job or manual trigger.
 */
export async function POST(req: NextRequest) {
  try {
    const result = await processEmailQueue()
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[API /email/process]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
