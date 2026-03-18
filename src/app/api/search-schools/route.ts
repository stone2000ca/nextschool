import { searchSchoolsLogic } from '@/lib/functions/searchSchools'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await searchSchoolsLogic(params)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Search error:', error.message)
    return NextResponse.json({
      error: error.message === 'Search request timeout' ? 'Search timed out - try being more specific' : error.message,
      status: 500
    }, { status: 500 })
  }
}
