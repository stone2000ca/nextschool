import { fetchSchoolProfile } from '@/lib/functions/fetchSchoolProfile'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await fetchSchoolProfile(params)
    return NextResponse.json(result)
  } catch (error: any) {
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message }, { status })
  }
}
