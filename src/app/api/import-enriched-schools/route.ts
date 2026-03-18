import { importEnrichedSchoolsLogic } from '@/lib/functions/importEnrichedSchools'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await importEnrichedSchoolsLogic(params)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[FATAL]', error.message)
    return NextResponse.json({ error: error.message || 'Import failed' }, { status: error.status || 500 })
  }
}
