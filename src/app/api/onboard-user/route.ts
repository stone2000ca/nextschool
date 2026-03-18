import { onboardUser } from '@/lib/functions/onboardUser'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await onboardUser(params)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('onboardUser error:', error);
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message }, { status })
  }
}
