import { matchSchoolsForProfileLogic } from '@/lib/functions/matchSchoolsForProfile'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await matchSchoolsForProfileLogic(params)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[matchSchoolsForProfile] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: error.status || 500 })
  }
}
