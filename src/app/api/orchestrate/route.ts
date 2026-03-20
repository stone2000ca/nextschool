import { orchestrateConversationLogic } from '@/lib/functions/orchestrate'
import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const result = await orchestrateConversationLogic(params)

    // E41-S3: Use waitUntil() for deferred background work (e.g. RESULTS extractEntities)
    if (result?._deferredWork) {
      for (const promise of result._deferredWork) {
        waitUntil(promise)
      }
      delete result._deferredWork
    }

    return NextResponse.json({ data: result })
  } catch (error: any) {
    console.error('[orchestrate] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
