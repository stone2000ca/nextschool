import { updateSchoolPhotosLogic } from '@/lib/functions/updateSchoolPhotos'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json().catch(() => ({}))
    const result = await updateSchoolPhotosLogic(params as any)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[UPDATE PHOTOS] Fatal:', error?.message || error)
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 })
  }
}
