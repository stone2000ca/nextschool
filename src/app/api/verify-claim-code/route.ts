import { verifyClaimCode } from '@/lib/functions/verifyClaimCode'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await verifyClaimCode(params)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('verifyClaimCode error:', error.message);
    const status = error.statusCode || 500
    return NextResponse.json({ success: false, error: error.message || 'An unexpected error occurred.' }, { status })
  }
}
