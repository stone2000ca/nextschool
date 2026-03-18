import { handleResultsLogic } from '@/lib/functions/handleResults'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await handleResultsLogic(params)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[handleResults] FATAL:', error)
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 })
  }
}
