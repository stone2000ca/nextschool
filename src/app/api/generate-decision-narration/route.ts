import { generateDecisionNarrationLogic } from '@/lib/functions/generateDecisionNarration'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await generateDecisionNarrationLogic(params)
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
