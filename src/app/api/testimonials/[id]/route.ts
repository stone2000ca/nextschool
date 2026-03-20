import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Testimonial } from '@/lib/entities-server'

/**
 * PATCH /api/testimonials/[id] — update a testimonial (auth required)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const updated = await Testimonial.update(id, body)
    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('PATCH /api/testimonials/[id] failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * DELETE /api/testimonials/[id] — delete a testimonial (auth required)
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    await Testimonial.delete(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('DELETE /api/testimonials/[id] failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
