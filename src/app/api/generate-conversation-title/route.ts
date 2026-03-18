import { generateConversationTitle } from '@/lib/functions/generateConversationTitle'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await generateConversationTitle(params)
    return NextResponse.json(result)
  } catch (error: any) {
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message }, { status })
  }
}
