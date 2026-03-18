import { updateUserMemory } from '@/lib/functions/updateUserMemory'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await updateUserMemory(params)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Memory update error:', error);
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message }, { status })
  }
}
