import { geocodeSchoolsLogic } from '@/lib/functions/geocodeSchools'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    let params = {};
    try { params = await req.json(); } catch (_) {}
    const result = await geocodeSchoolsLogic(params as any)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[geocodeSchools] Fatal error:', error.message)
    return NextResponse.json({ error: error.message, processed: 0, updated: 0, failed: 0, errors: [error.message] }, { status: error.status || 500 })
  }
}
