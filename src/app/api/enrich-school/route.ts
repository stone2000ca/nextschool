import { enrichSchoolFromWebLogic } from '@/lib/functions/enrichSchoolFromWeb'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await enrichSchoolFromWebLogic(params)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[ENRICH] Fatal error:', error.message)
    return NextResponse.json({ error: error.message }, { status: error.status || 500 })
  }
}
