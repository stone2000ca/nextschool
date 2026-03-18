import { getNearbySchools } from '@/lib/functions/getNearbySchools'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await getNearbySchools(params)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[getNearbySchools] Error:', error.message);
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message }, { status })
  }
}
