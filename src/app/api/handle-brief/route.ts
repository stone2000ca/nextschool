import { handleBriefLogic } from '@/lib/functions/handleBrief'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await handleBriefLogic(params)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[handleBrief] FATAL:', error)
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 })
  }
}
