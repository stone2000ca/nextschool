import { scrapeSchoolPhotosLogic } from '@/lib/functions/scrapeSchoolPhotos'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await scrapeSchoolPhotosLogic(params)
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 })
  }
}
