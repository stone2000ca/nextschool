import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { schoolAdminOnboard } from '@/lib/functions/schoolAdminOnboard'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, websiteUrl } = await req.json()
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'School name is required' }, { status: 400 })
    }

    const result = await schoolAdminOnboard({
      name: name.trim(),
      websiteUrl,
      userId: user.id,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[API /schools/onboard POST]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
