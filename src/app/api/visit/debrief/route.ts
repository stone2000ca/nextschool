import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { buildDeepLink } from '@/components/utils/buildDeepLink'

/**
 * POST /api/visit/debrief — E51-S1A
 *
 * Tokenized debrief endpoint for email one-click reactions.
 * Accepts a one-time token + reaction, writes to Supabase,
 * then redirects the user to the visit card deep link.
 *
 * Body: { token: string, reaction: string }
 *
 * Flow:
 *   1. Look up token in debrief_tokens table
 *   2. If expired or already used → redirect to /visit/debrief/expired
 *   3. If valid → write reaction, mark token used, redirect to deep link
 */
export async function POST(req: NextRequest) {
  try {
    const { token, reaction } = await req.json()

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }
    if (!reaction) {
      return NextResponse.json({ error: 'Reaction is required' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Look up the token
    const { data: tokenRow, error: lookupError } = await supabase
      .from('debrief_tokens')
      .select('*')
      .eq('token', token)
      .single()

    if (lookupError || !tokenRow) {
      return NextResponse.json(
        { error: 'expired', redirect: '/visit/debrief/expired' },
        { status: 410 },
      )
    }

    // Check if already used
    if (tokenRow.used_at) {
      return NextResponse.json(
        { error: 'expired', redirect: '/visit/debrief/expired' },
        { status: 410 },
      )
    }

    // Check if expired
    if (new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'expired', redirect: '/visit/debrief/expired' },
        { status: 410 },
      )
    }

    // Write reaction and mark token as used
    const { error: updateError } = await supabase
      .from('debrief_tokens')
      .update({
        reaction,
        used_at: new Date().toISOString(),
      })
      .eq('id', tokenRow.id)

    if (updateError) {
      console.error('[API /visit/debrief] Failed to update token:', updateError)
      return NextResponse.json({ error: 'Failed to save reaction' }, { status: 500 })
    }

    // Resolve school slug for the deep link
    let schoolSlug = tokenRow.school_slug
    if (!schoolSlug && tokenRow.school_id) {
      const { data: school } = await supabase
        .from('schools')
        .select('slug')
        .eq('id', tokenRow.school_id)
        .single()
      schoolSlug = school?.slug
    }

    // Build redirect URL to the visit card
    const redirectUrl = buildDeepLink({
      school: schoolSlug || undefined,
      tab: 'notepad',
      section: 'debrief',
      visitId: tokenRow.visit_id,
    })

    return NextResponse.json({
      success: true,
      redirect: redirectUrl,
    })
  } catch (error: any) {
    console.error('[API /visit/debrief]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
