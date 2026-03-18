import { handleDeepDiveLogic } from '@/lib/functions/handleDeepDive'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await handleDeepDiveLogic(params)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[DEEPDIVE] Fatal error:', error)
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 })
  }
}
