import { createCheckoutSessionLogic } from '@/lib/functions/createCheckoutSession'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await createCheckoutSessionLogic(params)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Checkout session creation failed:', error)
    return NextResponse.json({ error: error.message }, { status: error.status || 500 })
  }
}
