import { generateSharedShortlistLink } from '@/lib/functions/generateSharedShortlistLink'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await generateSharedShortlistLink(params)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[generateSharedShortlistLink] Error:', error);
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message }, { status })
  }
}
