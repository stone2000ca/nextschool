import { handleJourneyOutcome } from '@/lib/functions/handleJourneyOutcome'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await handleJourneyOutcome(params)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[E29-019] Unexpected error:', error.message);
    const status = error.statusCode || 500
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error', code: status },
      { status }
    )
  }
}
