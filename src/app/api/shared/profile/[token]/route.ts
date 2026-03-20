import { NextRequest, NextResponse } from 'next/server'
import { ChatSession } from '@/lib/entities-server'

/**
 * GET /api/shared/profile/[token] — public endpoint, no auth required
 * Returns session data for a shared profile link
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 })
    }

    const sessions = await ChatSession.filter({ share_token: token })
    if (sessions.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(sessions[0])
  } catch (error: any) {
    console.error('GET /api/shared/profile/[token] failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
