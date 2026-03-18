import { trackSessionEvent } from '@/lib/functions/trackSessionEvent'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await trackSessionEvent(params)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Failed to track session event:', error);
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message }, { status })
  }
}
