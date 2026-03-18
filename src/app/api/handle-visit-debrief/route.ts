import { handleVisitDebriefLogic } from '@/lib/functions/handleVisitDebrief'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await handleVisitDebriefLogic(params)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[handleVisitDebrief] FATAL:', error)
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 })
  }
}
