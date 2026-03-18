import { orchestrateConversationLogic } from '@/lib/functions/orchestrate'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await orchestrateConversationLogic(params)
    return NextResponse.json({ data: result })
  } catch (error: any) {
    console.error('[orchestrate] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
