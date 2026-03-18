import { generateMatchExplanationsLogic } from '@/lib/functions/generateMatchExplanations'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await generateMatchExplanationsLogic(params)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error generating match explanations:', error)
    return NextResponse.json({
      error: error.message,
      explanations: []
    }, { status: 500 })
  }
}
