import { processTokenTransaction } from '@/lib/functions/processTokenTransaction'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    // NOTE: In production, extract user from session/auth middleware
    // For now, user must be passed in the request body or resolved from auth
    const result = await processTokenTransaction(params)
    return NextResponse.json(result)
  } catch (error: any) {
    const status = error.statusCode || 500
    const response: any = { error: error.message }
    if (error.details) {
      Object.assign(response, error.details)
    }
    return NextResponse.json(response, { status })
  }
}
