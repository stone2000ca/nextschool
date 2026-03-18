import { generateProfileNarrativeLogic } from '@/lib/functions/generateProfileNarrative'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await generateProfileNarrativeLogic(params)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[generateProfileNarrative] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: error.status || 500 })
  }
}
