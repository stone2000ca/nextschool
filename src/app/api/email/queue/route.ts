import { NextRequest, NextResponse } from 'next/server'
import { queueVisitEmails } from '@/lib/functions/emailQueue'

/**
 * POST /api/email/queue — E51-S4A
 *
 * Queue visit-related emails when a visit is created.
 * Body: { visitRecordId, userId, visitDate }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { visitRecordId, userId, visitDate } = body

    if (!visitRecordId || !userId || !visitDate) {
      return NextResponse.json(
        { error: 'visitRecordId, userId, and visitDate are required' },
        { status: 400 },
      )
    }

    const result = await queueVisitEmails({ visitRecordId, userId, visitDate })
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[API /email/queue]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
