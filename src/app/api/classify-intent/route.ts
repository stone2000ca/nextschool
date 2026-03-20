import { classifyIntentLogic } from '@/lib/functions/classifyIntent'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { message, sessionState } = await req.json()
    const result = classifyIntentLogic(message || '', sessionState)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json(
      { gate: 'CONVERSATION', confidence: 'HIGH' },
      { status: 200 }
    )
  }
}
