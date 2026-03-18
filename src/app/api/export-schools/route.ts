import { exportSchoolsLogic } from '@/lib/functions/exportSchools'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const allSchools = await exportSchoolsLogic()
    const jsonData = JSON.stringify(allSchools, null, 2)

    return new NextResponse(jsonData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="schools_export_${new Date().toISOString().split('T')[0]}.json"`,
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
