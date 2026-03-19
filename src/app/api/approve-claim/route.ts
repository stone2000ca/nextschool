import { approveClaim } from '@/lib/functions/approveClaim'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await approveClaim(params)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Approve claim failed:', error)
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message }, { status })
  }
}
