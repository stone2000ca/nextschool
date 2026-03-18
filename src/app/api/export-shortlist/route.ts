import { exportShortlistLogic } from '@/lib/functions/exportShortlist'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await exportShortlistLogic(params)
    return NextResponse.json(result)
  } catch (error: any) {
    if (error.needsUpgrade) {
      return NextResponse.json({ error: 'Insufficient tokens', needsUpgrade: true }, { status: 402 })
    }
    return NextResponse.json({ error: error.message }, { status: error.status || 500 })
  }
}
