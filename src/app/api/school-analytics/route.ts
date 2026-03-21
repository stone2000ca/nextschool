import { getSchoolAnalytics } from '@/lib/functions/getSchoolAnalytics'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const schoolId = req.nextUrl.searchParams.get('school_id')
    if (!schoolId) {
      return NextResponse.json({ error: 'school_id is required' }, { status: 400 })
    }

    const result = await getSchoolAnalytics(schoolId)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[API /school-analytics GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
