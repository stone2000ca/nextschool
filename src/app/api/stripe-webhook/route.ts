import { handleStripeWebhookLogic } from '@/lib/functions/handleStripeWebhook'
import { NextRequest, NextResponse } from 'next/server'

// Stripe webhook needs raw body access - disable body parsing
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('stripe-signature') || ''
    const result = await handleStripeWebhookLogic(rawBody, signature)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Webhook processing failed:', error)
    return NextResponse.json({ error: error.message }, { status: error.status || 500 })
  }
}
