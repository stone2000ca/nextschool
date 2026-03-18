import { processDebriefCompletion } from '@/lib/functions/processDebriefCompletion'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await processDebriefCompletion(params)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[E29-010] processDebriefCompletion failed:', error?.message || error);
    const status = error.statusCode || 500
    return NextResponse.json({ error: '[E29-010] ' + (error?.message || 'Unknown error') }, { status })
  }
}
